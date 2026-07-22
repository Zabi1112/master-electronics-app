const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Op } = require("sequelize");
const { Product, ProductBatch, Sale, Installment, Customer, User, ShopTransaction } = require("../models");
const logActivity = require("../utils/activityLogger");
const { recalculateShopBalance } = require("./shopAccountController");

const generateInvoiceNo = () => {
  return `ME-${Date.now()}`;
};

const getInstallmentMarkup = (months) => {
  if (Number(months) === 3) return 20;
  if (Number(months) === 6) return 30;
  if (Number(months) === 12) return 40;
  return 0;
};

const getInstallmentDueDate = (startDate, frequency, index, dueDay = 10) => {
  const d = new Date(startDate);

  if (frequency === "daily") {
    d.setDate(d.getDate() + index);
  } else if (frequency === "weekly") {
    d.setDate(d.getDate() + index * 7);
  } else {
    d.setMonth(d.getMonth() + index);
    d.setDate(dueDay);
  }

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
      installmentFrequency = "monthly",
      markupPercent,
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

    const batches = await ProductBatch.findAll({
      where: { productId, remainingQuantity: { [Op.gt]: 0 } },
      order: [["purchaseDate", "ASC"], ["id", "ASC"]],
      transaction: t,
    });

    const batch = batches.find((b) => Number(b.remainingQuantity) >= Number(quantity));

    if (batches.length && !batch) {
      await t.rollback();
      return res.status(400).json({
        message:
          "Stock for this item is split across purchase batches at different prices, and no single batch has enough remaining quantity to cover this sale. Please sell a smaller quantity.",
      });
    }

    let finalAmount = 0;
    let totalPaid = 0;
    let remainingAmount = 0;
    let monthlyInstallment = 0;
    let expectedClearDate = null;
    let finalCashPrice = 0;
    let finalInstallmentPrice = 0;

    // Fall back to the product's own purchasePrice for legacy stock that predates batch tracking.
    const totalPurchase = batch
      ? Number(batch.purchasePrice || 0) * Number(quantity)
      : Number(product.purchasePrice || 0) * Number(quantity);

    if (saleType === "cash") {
      finalCashPrice = Number(salePrice || product.salePrice || 0) * Number(quantity);
      finalAmount = finalCashPrice - Number(discount || 0);
      totalPaid = Number(paidAmount || finalAmount);
      remainingAmount = finalAmount - totalPaid;
    }

    let appliedMarkupPercent = 0;
    let resolvedFrequency = "monthly";

    if (saleType === "installment") {
      if (!customerId) {
        await t.rollback();
        return res.status(400).json({ message: "Customer is required for installment sale" });
      }

      const frequency = ["daily", "weekly", "monthly"].includes(installmentFrequency)
        ? installmentFrequency
        : "monthly";

      resolvedFrequency = frequency;

      if (frequency === "monthly") {
        const allowedMonths = [3, 6, 12];

        if (!allowedMonths.includes(Number(installmentMonths))) {
          await t.rollback();
          return res.status(400).json({
            message: "Installment months must be 3, 6, or 12",
          });
        }

        appliedMarkupPercent = getInstallmentMarkup(installmentMonths);
      } else {
        if (!Number.isInteger(Number(installmentMonths)) || Number(installmentMonths) < 2) {
          await t.rollback();
          return res.status(400).json({
            message: "Number of installments must be a whole number of at least 2",
          });
        }

        if (markupPercent === undefined || markupPercent === null || markupPercent === "" || Number(markupPercent) < 0) {
          await t.rollback();
          return res.status(400).json({
            message: "Markup % is required for daily/weekly installment plans",
          });
        }

        appliedMarkupPercent = Number(markupPercent);
      }

      finalCashPrice =
        Number(cashPrice || product.salePrice || product.salePrice || 0) *
        Number(quantity);

      finalInstallmentPrice =
        finalCashPrice + (finalCashPrice * appliedMarkupPercent) / 100;

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
        frequency,
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

    const duplicateWindowMs = 30 * 1000; // prevent accidental double submissions
    const duplicateSearch = {
      saleType,
      productId,
      quantity,
      discount,
      salePrice: saleType === "cash" ? finalCashPrice : finalInstallmentPrice,
      cashPrice: finalCashPrice,
      finalAmount,
      paidAmount: totalPaid,
      remainingAmount,
      soldBy: req.user.id,
      createdAt: {
        [Op.gte]: new Date(Date.now() - duplicateWindowMs),
      },
    };

    if (saleType === "installment") {
      duplicateSearch.customerId = customerId;
      duplicateSearch.installmentMonths = installmentMonths;
      duplicateSearch.installmentStartDate =
        installmentStartDate || new Date().toISOString().split("T")[0];
    } else {
      duplicateSearch.customerId = null;
    }

    const existingDuplicate = await Sale.findOne({
      where: duplicateSearch,
      transaction: t,
    });

    if (existingDuplicate) {
      await t.rollback();
      return res.status(409).json({
        message:
          "Duplicate sale detected: the same sale was submitted recently. Please check the invoice before creating it again.",
      });
    }

    const sale = await Sale.create(
      {
        invoiceNo: generateInvoiceNo(),
        saleType,

        customerId: saleType === "installment" ? customerId : null,
        productId,
        productBatchId: batch ? batch.id : null,
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
        installmentFrequency:
          saleType === "installment" ? resolvedFrequency : "monthly",
        markupPercent: saleType === "installment" ? appliedMarkupPercent : 0,
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

    if (batch) {
      batch.remainingQuantity = Number(batch.remainingQuantity) - Number(quantity);
      await batch.save({ transaction: t });
    }

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
            dueDate: getInstallmentDueDate(startDate, resolvedFrequency, i - 1, 10),
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

    if (totalPaid > 0) {
      await ShopTransaction.create(
        {
          type: "collection",
          sourceType: saleType === "cash" ? "cash_sale" : "advance_payment",
          sourceId: sale.id,
          amount: totalPaid,
          description: `${saleType === "cash" ? "Cash sale" : "Advance payment"} - invoice ${sale.invoiceNo}`,
          transactionDate: new Date().toISOString().split("T")[0],
          createdBy: req.user.id,
        },
        { transaction: t }
      );

      await recalculateShopBalance(t);
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

const todayDate = () => new Date().toISOString().split("T")[0];

exports.payCashSaleBalance = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { amount } = req.body;

    const sale = await Sale.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    if (sale.saleType !== "cash") {
      await t.rollback();
      return res.status(400).json({
        message: "This is an installment sale — use the installment payment flow instead",
      });
    }

    const currentRemaining = Number(sale.remainingAmount || 0);

    if (currentRemaining <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Sale already fully paid" });
    }

    const payAmount = Number(amount);

    if (!payAmount || payAmount <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    if (payAmount > currentRemaining) {
      await t.rollback();
      return res.status(400).json({
        message: "Payment amount cannot be greater than the remaining balance",
        remainingAmount: currentRemaining,
      });
    }

    const previousPaid = Number(sale.paidAmount || 0);
    const newPaid = previousPaid + payAmount;

    sale.paidAmount = newPaid;
    sale.remainingAmount = currentRemaining - payAmount;

    if (sale.remainingAmount <= 0) {
      sale.remainingAmount = 0;
      sale.status = "completed";
    }

    const totalPurchase = Number(sale.purchasePrice || 0);
    const totalProfit = Number(sale.profit || 0);

    sale.profitRecovered = Math.max(0, newPaid - totalPurchase);
    if (sale.profitRecovered > totalProfit) {
      sale.profitRecovered = totalProfit;
    }
    sale.profitPending = Math.max(0, totalProfit - sale.profitRecovered);

    await sale.save({ transaction: t });

    await ShopTransaction.create(
      {
        type: "collection",
        sourceType: "cash_sale",
        sourceId: sale.id,
        amount: payAmount,
        description: `Balance payment - invoice ${sale.invoiceNo}`,
        transactionDate: todayDate(),
        createdBy: req.user.id,
      },
      { transaction: t }
    );

    await recalculateShopBalance(t);

    await t.commit();

    await logActivity({
      req,
      action: "pay",
      module: "sales",
      recordId: sale.id,
      description: `Received balance payment Rs. ${payAmount} for invoice ${sale.invoiceNo}`,
      newData: sale.toJSON(),
    });

    res.json({
      message: "Payment recorded successfully",
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