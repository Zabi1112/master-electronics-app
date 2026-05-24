const { Op } = require("sequelize");
const { sequelize } = require("../config/db");

const {
  Sale,
  Installment,
  Customer,
  User,
  Product,
} = require("../models");

const todayDate = () => new Date().toISOString().split("T")[0];

const calculateFine = (installment, paymentDate = new Date()) => {
  const dueDate = new Date(installment.dueDate);
  const payDate = new Date(paymentDate);

  dueDate.setHours(0, 0, 0, 0);
  payDate.setHours(0, 0, 0, 0);

  if (payDate <= dueDate) {
    return {
      lateDays: 0,
      fineAmount: 0,
    };
  }

  const diffTime = payDate - dueDate;
  const lateDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const fineAmount =
    Number(installment.remainingAmount || 0) *
    (Number(installment.finePercentPerDay || 1.5) / 100) *
    lateDays;

  return {
    lateDays,
    fineAmount: Math.round(fineAmount),
  };
};

exports.payInstallment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { amount, fineDiscount = 0, notes } = req.body;

    const installment = await Installment.findByPk(req.params.id, {
      transaction: t,
    });

    if (!installment) {
      await t.rollback();
      return res.status(404).json({ message: "Installment not found" });
    }

    if (installment.status === "paid") {
      await t.rollback();
      return res.status(400).json({ message: "Installment already paid" });
    }

    const payAmount = Number(amount);
    const discountFine = Number(fineDiscount || 0);

    if (!payAmount || payAmount <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const fineData = calculateFine(installment);

    const finalFineAmount = Math.max(0, fineData.fineAmount - discountFine);

    const totalPayable =
      Number(installment.remainingAmount || 0) + Number(finalFineAmount);

    if (payAmount > totalPayable) {
      await t.rollback();
      return res.status(400).json({
        message: "Payment amount cannot be greater than total payable amount",
        totalPayable,
      });
    }

    let remainingPayment = payAmount;

    const finePaidNow = Math.min(remainingPayment, finalFineAmount);
    remainingPayment -= finePaidNow;

    const installmentPaidNow = Math.min(
      remainingPayment,
      Number(installment.remainingAmount || 0)
    );

    installment.fineAmount = fineData.fineAmount;
    installment.fineDiscount =
      Number(installment.fineDiscount || 0) + discountFine;
    installment.finePaid = Number(installment.finePaid || 0) + finePaidNow;
    installment.lateDays = fineData.lateDays;

    installment.paidAmount =
      Number(installment.paidAmount || 0) + installmentPaidNow;

    installment.remainingAmount =
      Number(installment.remainingAmount || 0) - installmentPaidNow;

    installment.receivedBy = req.user.id;
    installment.notes = notes || installment.notes;

    if (installment.remainingAmount <= 0) {
      installment.remainingAmount = 0;
      installment.status = "paid";
      installment.paidDate = todayDate();
    } else {
      installment.status = "partial";
    }

    await installment.save({ transaction: t });

    const sale = await Sale.findByPk(installment.saleId, {
      transaction: t,
    });

    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    const previousPaid = Number(sale.paidAmount || 0);
    const newPaid = previousPaid + installmentPaidNow;

    sale.paidAmount = newPaid;
    sale.remainingAmount =
      Number(sale.remainingAmount || 0) - installmentPaidNow;

    if (sale.remainingAmount < 0) {
      sale.remainingAmount = 0;
    }

    const unpaidInstallments = await Installment.count({
      where: {
        saleId: sale.id,
        status: {
          [Op.in]: ["pending", "partial"],
        },
      },
      transaction: t,
    });

    if (sale.remainingAmount <= 0 || unpaidInstallments === 0) {
      sale.remainingAmount = 0;
      sale.status = "cleared";
    }

    const totalPurchase = Number(sale.purchasePrice || 0);
    const totalProfit = Number(sale.profit || 0);

    sale.profitRecovered = Math.max(0, newPaid - totalPurchase);

    if (sale.profitRecovered > totalProfit) {
      sale.profitRecovered = totalProfit;
    }

    sale.profitPending = totalProfit - sale.profitRecovered;

    if (sale.profitPending < 0) {
      sale.profitPending = 0;
    }

    await sale.save({ transaction: t });

    await t.commit();

    res.json({
      message: "Installment payment received successfully",
      totalPayable,
      fineCalculated: fineData.fineAmount,
      fineDiscount: discountFine,
      finePaid: finePaidNow,
      installmentPaid: installmentPaidNow,
      installment,
      sale,
    });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Payment failed",
      error: error.message,
    });
  }
};

exports.getPendingInstallments = async (req, res) => {
  try {
    const installments = await Installment.findAll({
      where: {
        status: {
          [Op.in]: ["pending", "partial"],
        },
      },
      include: [
        { model: Customer, as: "customer" },
        { model: Sale, as: "sale" },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["dueDate", "ASC"]],
    });

    const withFine = installments.map((item) => {
      const data = item.toJSON();
      const fine = calculateFine(data);

      return {
        ...data,
        liveLateDays: fine.lateDays,
        liveFineAmount: fine.fineAmount,
        liveTotalPayable:
          Number(data.remainingAmount || 0) + Number(fine.fineAmount || 0),
      };
    });

    res.json(withFine);
  } catch (error) {
    res.status(500).json({
      message: "Get pending installments failed",
      error: error.message,
    });
  }
};

exports.getOverdueInstallments = async (req, res) => {
  try {
    const today = todayDate();

    const installments = await Installment.findAll({
      where: {
        dueDate: {
          [Op.lt]: today,
        },
        status: {
          [Op.in]: ["pending", "partial"],
        },
      },
      include: [
        { model: Customer, as: "customer" },
        { model: Sale, as: "sale" },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["dueDate", "ASC"]],
    });

    const withFine = installments.map((item) => {
      const data = item.toJSON();
      const fine = calculateFine(data);

      return {
        ...data,
        liveLateDays: fine.lateDays,
        liveFineAmount: fine.fineAmount,
        liveTotalPayable:
          Number(data.remainingAmount || 0) + Number(fine.fineAmount || 0),
      };
    });

    res.json(withFine);
  } catch (error) {
    res.status(500).json({
      message: "Get overdue installments failed",
      error: error.message,
    });
  }
};

exports.getInstallmentCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({
      where: {
        customerType: "installment",
      },
      order: [["name", "ASC"]],
    });

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: "Get installment customers failed",
      error: error.message,
    });
  }
};

exports.getCustomerInstallmentItems = async (req, res) => {
  try {
    const sales = await Sale.findAll({
      where: {
        customerId: req.params.customerId,
        saleType: "installment",
      },
      include: [
        {
          model: Product,
          as: "product",
        },
        {
          model: Customer,
          as: "customer",
        },
        {
          model: User,
          as: "salesman",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({
      message: "Get customer items failed",
      error: error.message,
    });
  }
};

exports.getSaleInstallments = async (req, res) => {
  try {
    const installments = await Installment.findAll({
      where: {
        saleId: req.params.saleId,
      },
      include: [
        {
          model: Customer,
          as: "customer",
        },
        {
          model: Sale,
          as: "sale",
        },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["installmentNo", "ASC"]],
    });

    const withFine = installments.map((item) => {
      const data = item.toJSON();
      const fine = calculateFine(data);

      return {
        ...data,
        liveLateDays: fine.lateDays,
        liveFineAmount: fine.fineAmount,
        liveTotalPayable:
          Number(data.remainingAmount || 0) + Number(fine.fineAmount || 0),
      };
    });

    res.json(withFine);
  } catch (error) {
    res.status(500).json({
      message: "Get sale installments failed",
      error: error.message,
    });
  }
};