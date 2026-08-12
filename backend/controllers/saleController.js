const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Op } = require("sequelize");
const { Product, ProductBatch, Sale, SaleItem, Installment, Customer, User, ShopTransaction } = require("../models");
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
      items,
      discount = 0,
      paidAmount = 0,
      advanceAmount,
      installmentMonths,
      installmentFrequency = "monthly",
      markupPercent,
      installmentStartDate,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "At least one item is required" });
    }

    const requestedProductIds = items.map((i) => Number(i.productId));

    if (new Set(requestedProductIds).size !== requestedProductIds.length) {
      await t.rollback();
      return res.status(400).json({
        message:
          "The same product cannot appear twice in one sale — increase its quantity on that line instead",
      });
    }

    // Installment-plan validation is sale-level (unchanged) and decides
    // appliedMarkupPercent, needed before per-item pricing below.
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
    }

    // Per-item pass: validate stock, pick a batch (same "one batch must
    // cover this line's full quantity" rule as before, just per line), and
    // decrement stock immediately within this transaction so a later line
    // for a different product sees consistent state. Duplicate products in
    // one cart are already rejected above, so this ordering never has to
    // deal with two lines contending for the same product's stock.
    const lineResults = [];

    for (const rawItem of items) {
      const itemProductId = Number(rawItem.productId);
      const itemQuantity = Number(rawItem.quantity || 1);

      if (!itemProductId || itemQuantity < 1) {
        await t.rollback();
        return res.status(400).json({ message: "Each item needs a valid product and quantity" });
      }

      const product = await Product.findByPk(itemProductId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!product) {
        await t.rollback();
        return res.status(404).json({ message: `Product #${itemProductId} not found` });
      }

      if (Number(product.quantity) < itemQuantity) {
        await t.rollback();
        return res.status(400).json({
          message: `Not enough stock available for ${product.productName}`,
        });
      }

      const batches = await ProductBatch.findAll({
        where: { productId: itemProductId, remainingQuantity: { [Op.gt]: 0 } },
        order: [["purchaseDate", "ASC"], ["id", "ASC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const batch = batches.find((b) => Number(b.remainingQuantity) >= itemQuantity);

      if (batches.length && !batch) {
        await t.rollback();
        return res.status(400).json({
          message: `Stock for ${product.productName} is split across purchase batches at different prices, and no single batch has enough remaining quantity to cover this line. Please sell a smaller quantity.`,
        });
      }

      // Fall back to the product's own purchasePrice for legacy stock that predates batch tracking.
      const linePurchasePrice = batch
        ? Number(batch.purchasePrice || 0) * itemQuantity
        : Number(product.purchasePrice || 0) * itemQuantity;

      let lineCashPrice = 0;
      let lineInstallmentPrice = 0;
      let lineRawPrice = 0;

      if (saleType === "cash") {
        lineCashPrice = Number(rawItem.salePrice || product.salePrice || 0) * itemQuantity;
        lineRawPrice = lineCashPrice;
      } else {
        lineCashPrice = Number(rawItem.cashPrice || product.salePrice || 0) * itemQuantity;
        lineInstallmentPrice = lineCashPrice + (lineCashPrice * appliedMarkupPercent) / 100;
        lineRawPrice = lineInstallmentPrice;
      }

      product.quantity = Number(product.quantity) - itemQuantity;

      if (product.quantity <= 0) {
        product.quantity = 0;
        product.status = "sold";
      }

      await product.save({ transaction: t });

      if (batch) {
        batch.remainingQuantity = Number(batch.remainingQuantity) - itemQuantity;
        await batch.save({ transaction: t });
      }

      lineResults.push({
        productId: itemProductId,
        productBatchId: batch ? batch.id : null,
        quantity: itemQuantity,
        purchasePrice: linePurchasePrice,
        cashPrice: lineCashPrice,
        installmentPrice: lineInstallmentPrice,
        rawPrice: lineRawPrice,
      });
    }

    const totalPurchase = lineResults.reduce((s, l) => s + l.purchasePrice, 0);
    const rawSaleTotal = lineResults.reduce((s, l) => s + l.rawPrice, 0);
    const discountAmount = Number(discount || 0);

    // Prorate the sale-level discount across lines by raw-price share, with
    // the remainder assigned to the last line so shares always sum exactly
    // to the sale-level discount (avoids float drift).
    let allocatedDiscount = 0;
    lineResults.forEach((line, index) => {
      const isLast = index === lineResults.length - 1;
      const share = isLast
        ? Math.round((discountAmount - allocatedDiscount) * 100) / 100
        : rawSaleTotal > 0
        ? Math.round(((discountAmount * line.rawPrice) / rawSaleTotal) * 100) / 100
        : 0;

      allocatedDiscount += share;
      line.discountShare = share;
      line.finalAmount = line.rawPrice - share;
      line.profit = line.finalAmount - line.purchasePrice;
    });

    const finalAmount = rawSaleTotal - discountAmount;

    let totalPaid = 0;
    let remainingAmount = 0;
    let monthlyInstallment = 0;
    let expectedClearDate = null;

    if (saleType === "cash") {
      totalPaid = Number(paidAmount || finalAmount);
      remainingAmount = finalAmount - totalPaid;
    } else {
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
        resolvedFrequency,
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
      discount: discountAmount,
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

    const candidateDuplicates = await Sale.findAll({
      where: duplicateSearch,
      include: [{ model: SaleItem, as: "items" }],
      transaction: t,
    });

    const incomingSignature = lineResults
      .map((l) => `${l.productId}:${l.quantity}`)
      .sort()
      .join("|");

    const existingDuplicate = candidateDuplicates.find((candidate) => {
      const candidateSignature = (candidate.items || [])
        .map((i) => `${i.productId}:${i.quantity}`)
        .sort()
        .join("|");
      return candidateSignature === incomingSignature;
    });

    if (existingDuplicate) {
      await t.rollback();
      return res.status(409).json({
        message:
          "Duplicate sale detected: the same sale was submitted recently. Please check the invoice before creating it again.",
      });
    }

    const firstLine = lineResults[0];
    const totalQuantity = lineResults.reduce((s, l) => s + l.quantity, 0);

    const sale = await Sale.create(
      {
        invoiceNo: generateInvoiceNo(),
        saleType,

        customerId: saleType === "installment" ? customerId : null,

        // Legacy single-product columns are kept NOT NULL-satisfied with a
        // best-effort representative value (first line's product, summed
        // quantity/pricing) purely so the existing schema constraints hold —
        // every read path goes through sale.items now, nothing reads these
        // for their own sake anymore.
        productId: firstLine.productId,
        productBatchId: firstLine.productBatchId,
        quantity: totalQuantity,

        purchasePrice: totalPurchase,

        cashPrice: lineResults.reduce((s, l) => s + l.cashPrice, 0),
        installmentPrice: lineResults.reduce((s, l) => s + l.installmentPrice, 0),

        salePrice: rawSaleTotal,
        discount: discountAmount,

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

    for (const line of lineResults) {
      await SaleItem.create(
        {
          saleId: sale.id,
          productId: line.productId,
          productBatchId: line.productBatchId,
          quantity: line.quantity,
          purchasePrice: line.purchasePrice,
          cashPrice: line.cashPrice,
          installmentPrice: line.installmentPrice,
          salePrice: line.rawPrice,
          discountShare: line.discountShare,
          finalAmount: line.finalAmount,
          profit: line.profit,
        },
        { transaction: t }
      );
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
        {
          model: SaleItem,
          as: "items",
          include: [
            { model: Product, as: "product" },
            { model: ProductBatch, as: "productBatch" },
          ],
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
        {
          model: SaleItem,
          as: "items",
          include: [
            { model: Product, as: "product" },
            { model: ProductBatch, as: "productBatch" },
          ],
        },
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