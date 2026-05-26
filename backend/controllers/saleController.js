const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Product, Sale, Installment, Customer, User } = require("../models");
const logActivity = require("../utils/activityLogger");

const generateInvoiceNo = () => {
  return `ME-${Date.now()}`;
};

const getInstallmentMarkup = (months) => {
  if (Number(months) === 3) return 20;
  if (Number(months) === 6) return 30;
  if (Number(months) === 12) return 40;
  return 0;
};

const getInstallmentDueDate = (startDate, monthIndex, dueDay = 10) => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + monthIndex);
  d.setDate(dueDay);
  return d.toISOString().split("T")[0];
};

exports.createSale = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      saleType,
      customerId,
      productId,
      quantity = 1,
      salePrice,
      cashPrice,
      discount = 0,
      paidAmount = 0,
      advanceAmount,
      installmentMonths,
      installmentStartDate,
    } = req.body;

    const product = await Product.findByPk(productId, { transaction: t });

    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    if (Number(product.quantity) < Number(quantity)) {
      await t.rollback();
      return res.status(400).json({ message: "Not enough stock available" });
    }

    let finalAmount = 0;
    let totalPaid = 0;
    let remainingAmount = 0;
    let monthlyInstallment = 0;
    let expectedClearDate = null;
    let finalCashPrice = 0;
    let finalInstallmentPrice = 0;

    const totalPurchase = Number(product.purchasePrice || 0) * Number(quantity);

    if (saleType === "cash") {
      finalCashPrice = Number(salePrice || product.salePrice || 0) * Number(quantity);
      finalAmount = finalCashPrice - Number(discount || 0);
      totalPaid = Number(paidAmount || finalAmount);
      remainingAmount = finalAmount - totalPaid;
    }

    if (saleType === "installment") {
      const allowedMonths = [3, 6, 12];

      if (!customerId) {
        await t.rollback();
        return res.status(400).json({ message: "Customer is required for installment sale" });
      }

      if (!allowedMonths.includes(Number(installmentMonths))) {
        await t.rollback();
        return res.status(400).json({
          message: "Installment months must be 3, 6, or 12",
        });
      }

      finalCashPrice =
        Number(cashPrice || product.salePrice || product.salePrice || 0) *
        Number(quantity);

      const markupPercent = getInstallmentMarkup(installmentMonths);

      finalInstallmentPrice =
        finalCashPrice + (finalCashPrice * markupPercent) / 100;

      finalAmount = finalInstallmentPrice - Number(discount || 0);

      const autoAdvance = finalAmount / Number(installmentMonths);

      totalPaid =
        advanceAmount !== undefined && advanceAmount !== null && advanceAmount !== ""
          ? Number(advanceAmount)
          : autoAdvance;

      remainingAmount = finalAmount - totalPaid;

      if (remainingAmount < 0) {
        await t.rollback();
        return res.status(400).json({
          message: "Advance amount cannot be greater than final amount",
        });
      }

      const remainingInstallmentCount = Number(installmentMonths) - 1;

      monthlyInstallment =
        remainingInstallmentCount > 0
          ? remainingAmount / remainingInstallmentCount
          : 0;

      const startDate =
        installmentStartDate || new Date().toISOString().split("T")[0];

      expectedClearDate = getInstallmentDueDate(
        startDate,
        Number(installmentMonths) - 1,
        10
      );
    }

    const profit = finalAmount - totalPurchase;

    let profitRecovered = 0;
    let profitPending = profit;

    if (totalPaid > totalPurchase) {
      profitRecovered = totalPaid - totalPurchase;
      if (profitRecovered > profit) profitRecovered = profit;
      profitPending = profit - profitRecovered;
    }

    if (profitPending < 0) profitPending = 0;

    const sale = await Sale.create(
      {
        invoiceNo: generateInvoiceNo(),
        saleType,

        customerId: saleType === "installment" ? customerId : null,
        productId,
        quantity,

        purchasePrice: totalPurchase,

        cashPrice: finalCashPrice,
        installmentPrice: finalInstallmentPrice,

        salePrice: saleType === "cash" ? finalCashPrice : finalInstallmentPrice,
        discount,

        finalAmount,

        advanceAmount: saleType === "installment" ? totalPaid : 0,

        paidAmount: totalPaid,
        remainingAmount,

        profit,
        profitRecovered,
        profitPending,

        installmentMonths: saleType === "installment" ? installmentMonths : null,
        monthlyInstallment:
          saleType === "installment" ? monthlyInstallment : null,

        installmentStartDate:
          saleType === "installment"
            ? installmentStartDate || new Date().toISOString().split("T")[0]
            : null,

        expectedClearDate,

        status:
          saleType === "cash"
            ? remainingAmount <= 0
              ? "completed"
              : "active"
            : remainingAmount <= 0
            ? "cleared"
            : "active",

        soldBy: req.user.id,
      },
      { transaction: t }
    );

    product.quantity = Number(product.quantity) - Number(quantity);

    if (product.quantity <= 0) {
      product.quantity = 0;
      product.status = "sold";
    }

    await product.save({ transaction: t });

    if (saleType === "installment") {
      const startDate =
        installmentStartDate || new Date().toISOString().split("T")[0];

      await Installment.create(
        {
          saleId: sale.id,
          customerId,
          installmentNo: 1,
          dueDate: startDate,
          amount: totalPaid,
          paidAmount: totalPaid,
          remainingAmount: 0,
          paidDate: startDate,
          finePercentPerDay: 1.5,
          fineAmount: 0,
          fineDiscount: 0,
          finePaid: 0,
          lateDays: 0,
          status: "paid",
          receivedBy: req.user.id,
          notes: "Advance received as first installment",
        },
        { transaction: t }
      );

      for (let i = 2; i <= Number(installmentMonths); i++) {
        await Installment.create(
          {
            saleId: sale.id,
            customerId,
            installmentNo: i,
            dueDate: getInstallmentDueDate(startDate, i - 1, 10),
            amount: monthlyInstallment,
            paidAmount: 0,
            remainingAmount: monthlyInstallment,
            finePercentPerDay: 1.5,
            fineAmount: 0,
            fineDiscount: 0,
            finePaid: 0,
            lateDays: 0,
            status: "pending",
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    await logActivity({
      req,
      action: "create",
      module: "sales",
      recordId: sale.id,
      description: `Created ${sale.saleType} sale ${sale.invoiceNo} - Rs. ${sale.finalAmount}`,
      newData: sale.toJSON(),
    });

    res.status(201).json({
      message: "Sale created successfully",
      sale,
    });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Create sale failed",
      error: error.message,
    });
  }
};

exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.findAll({
      include: [
        { model: Customer, as: "customer" },
        { model: Product, as: "product" },
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
      message: "Get sales failed",
      error: error.message,
    });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Product, as: "product" },
        {
          model: User,
          as: "salesman",
          attributes: ["id", "name", "username", "role"],
        },
      ],
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const installments = await Installment.findAll({
      where: { saleId: sale.id },
      include: [
        { model: Customer, as: "customer" },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["installmentNo", "ASC"]],
    });

    res.json({ sale, installments });
  } catch (error) {
    res.status(500).json({
      message: "Get sale failed",
      error: error.message,
    });
  }
};

exports.getInstallments = async (req, res) => {
  try {
    const installments = await Installment.findAll({
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

    res.json(installments);
  } catch (error) {
    res.status(500).json({
      message: "Get installments failed",
      error: error.message,
    });
  }
};