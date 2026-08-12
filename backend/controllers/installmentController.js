const { Op } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const logActivity = require("../utils/activityLogger");

const {
  Sale,
  SaleItem,
  Installment,
  Customer,
  User,
  Product,
  ActivityLog,
  ShopTransaction,
} = require("../models");
const { recalculateShopBalance } = require("./shopAccountController");

const todayDate = () => new Date().toISOString().split("T")[0];

// A sale's items (potentially multiple) collapsed into one display label,
// e.g. "iPhone 13" or "iPhone 13 +2 more".
const itemsToProductLabel = (items) => {
  if (!items || items.length === 0) return "-";

  const first = items[0]?.product?.productName || "-";

  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
};

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
    const { amount, fineDiscount = 0, notes, newFinalAmount } = req.body;

    const installment = await Installment.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
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

    // Admin-only: at the final installment, the price actually being
    // settled for can be renegotiated down. Everything checkable without
    // the Sale row is validated up front; the "is this actually the last
    // installment" check happens later once Sale is loaded (see below —
    // deliberately NOT fetched here, to preserve lock order, see note there).
    let reduceFinalAmount = null;
    let previousFinalAmountForLog = null;

    if (
      newFinalAmount !== undefined &&
      newFinalAmount !== null &&
      newFinalAmount !== ""
    ) {
      if (req.user.role !== "admin") {
        await t.rollback();
        return res.status(403).json({
          message: "Only an admin can reduce the sale's final amount",
        });
      }

      if (!notes || !String(notes).trim()) {
        await t.rollback();
        return res.status(400).json({
          message: "A note is required when reducing the final sale amount",
        });
      }

      reduceFinalAmount = Number(newFinalAmount);

      if (!Number.isFinite(reduceFinalAmount) || reduceFinalAmount < 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid final amount" });
      }
    }

    const fineData = calculateFine(installment);

    const finalFineAmount = Math.max(0, fineData.fineAmount - discountFine);

    const currentRemaining = Number(installment.remainingAmount || 0);
    const totalPayable = currentRemaining + Number(finalFineAmount);

    // Signed delta: positive = customer overpaid this installment, negative
    // = customer underpaid it. Both get re-amortized across future
    // pending/partial installments the same way (grow or shrink their
    // combined balance by exactly |delta|) — the only difference is an
    // underpayment can only be pushed forward if a future installment
    // actually exists to absorb it; otherwise it stays a local partial
    // payment like before.
    const delta = payAmount - totalPayable;

    let futureInstallments = [];
    let reamortizedDelta = 0;

    if (delta !== 0 && payAmount >= finalFineAmount) {
      futureInstallments = await Installment.findAll({
        where: {
          saleId: installment.saleId,
          installmentNo: { [Op.gt]: installment.installmentNo },
          status: { [Op.in]: ["pending", "partial"] },
        },
        order: [["installmentNo", "ASC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const futureTotalRemaining = futureInstallments.reduce(
        (sum, inst) => sum + Number(inst.remainingAmount || 0),
        0
      );

      if (delta > 0) {
        if (delta > futureTotalRemaining) {
          await t.rollback();
          return res.status(400).json({
            message:
              "Payment amount cannot be greater than the total remaining balance of the sale",
            totalPayable: totalPayable + futureTotalRemaining,
          });
        }

        reamortizedDelta = delta;
      } else if (futureInstallments.length > 0) {
        reamortizedDelta = delta;
      }

      if (reamortizedDelta !== 0) {
        // Re-amortize: shrink (excess) or grow (shortfall) the still-pending
        // future installments so their combined remaining balance moves by
        // exactly |reamortizedDelta|.
        const newFutureTotal = futureTotalRemaining - reamortizedDelta;
        const count = futureInstallments.length;
        let allocated = 0;

        for (let i = 0; i < count; i++) {
          const inst = futureInstallments[i];
          const isFinalShare = i === count - 1;
          const share = isFinalShare
            ? Math.round((newFutureTotal - allocated) * 100) / 100
            : Math.round((newFutureTotal / count) * 100) / 100;

          allocated += share;

          const paidPart = Number(inst.paidAmount || 0);
          inst.amount = paidPart + share;
          inst.remainingAmount = share;

          if (share <= 0) {
            inst.remainingAmount = 0;
            inst.status = "paid";
            inst.paidDate = inst.paidDate || todayDate();
          } else {
            inst.status = paidPart > 0 ? "partial" : "pending";
          }

          await inst.save({ transaction: t });
        }
      } else {
        futureInstallments = [];
      }
    }

    let finePaidNow;
    let installmentPaidNow;

    if (reamortizedDelta !== 0) {
      // This installment fully settles — the excess/shortfall in principal
      // has been redistributed across future installments, so its own
      // "amount" grows or shrinks to match exactly what was collected now.
      finePaidNow = finalFineAmount;
      installmentPaidNow = payAmount - finePaidNow;
      installment.amount = Number(installment.amount || 0) + reamortizedDelta;
    } else {
      let remainingPayment = payAmount;
      finePaidNow = Math.min(remainingPayment, finalFineAmount);
      remainingPayment -= finePaidNow;
      installmentPaidNow = Math.min(remainingPayment, currentRemaining);
    }

    installment.fineAmount = fineData.fineAmount;
    installment.fineDiscount =
      Number(installment.fineDiscount || 0) + discountFine;
    installment.finePaid = Number(installment.finePaid || 0) + finePaidNow;
    installment.lateDays = fineData.lateDays;

    installment.paidAmount =
      Number(installment.paidAmount || 0) + installmentPaidNow;

    if (reamortizedDelta !== 0) {
      installment.remainingAmount = 0;
      installment.status = "paid";
      installment.paidDate = installment.paidDate || todayDate();
    } else {
      installment.remainingAmount =
        Number(installment.remainingAmount || 0) - installmentPaidNow;

      if (installment.remainingAmount <= 0) {
        installment.remainingAmount = 0;
        installment.status = "paid";
        installment.paidDate = todayDate();
      } else {
        installment.status = "partial";
      }
    }

    installment.receivedBy = req.user.id;
    installment.notes = notes || installment.notes;

    // Sale is locked here — after the installment row and any future
    // installment rows are already locked/settled above — so every
    // transaction that touches a sale's installments locks rows in the same
    // order (installment(s) first, sale last). Locking Sale any earlier
    // (e.g. up front, to read installmentMonths) lets two concurrent
    // payments on the same sale lock rows in opposite orders and deadlock.
    const sale = await Sale.findByPk(installment.saleId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    if (reduceFinalAmount !== null) {
      const isLastInstallment =
        installment.installmentNo === Number(sale.installmentMonths);

      if (!isLastInstallment) {
        await t.rollback();
        return res.status(400).json({
          message:
            "Final amount can only be reduced when paying the last installment",
        });
      }

      const projectedPaid = Number(sale.paidAmount || 0) + installmentPaidNow;

      if (reduceFinalAmount < projectedPaid) {
        await t.rollback();
        return res.status(400).json({
          message:
            "New final amount cannot be less than what has already been paid",
        });
      }

      previousFinalAmountForLog = Number(sale.finalAmount || 0);
      sale.finalAmount = reduceFinalAmount;

      // Last installment closes out fully at the renegotiated price — any
      // remaining balance on it is forgiven, not left dangling as partial.
      installment.amount = Number(installment.paidAmount || 0);
      installment.remainingAmount = 0;
      installment.status = "paid";
      installment.paidDate = installment.paidDate || todayDate();
    }

    await installment.save({ transaction: t });

    const totalPrincipalPaidNow = installmentPaidNow;

    const previousPaid = Number(sale.paidAmount || 0);
    const newPaid = previousPaid + totalPrincipalPaidNow;

    sale.paidAmount = newPaid;

    sale.remainingAmount =
      reduceFinalAmount !== null
        ? Math.max(0, reduceFinalAmount - newPaid)
        : Number(sale.remainingAmount || 0) - totalPrincipalPaidNow;

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

    let totalProfit;
    if (reduceFinalAmount !== null) {
      totalProfit = Number(sale.finalAmount || 0) - totalPurchase;
      sale.profit = totalProfit;
    } else {
      totalProfit = Number(sale.profit || 0);
    }

    sale.profitRecovered = Math.max(0, newPaid - totalPurchase);

    if (sale.profitRecovered > totalProfit) {
      sale.profitRecovered = totalProfit;
    }

    sale.profitPending = totalProfit - sale.profitRecovered;

    if (sale.profitPending < 0) {
      sale.profitPending = 0;
    }

    await sale.save({ transaction: t });

    if (installmentPaidNow > 0) {
      await ShopTransaction.create(
        {
          type: "collection",
          sourceType: "installment_payment",
          sourceId: installment.id,
          amount: installmentPaidNow,
          description: `Installment #${installment.installmentNo} payment - invoice ${sale.invoiceNo}`,
          transactionDate: todayDate(),
          createdBy: req.user.id,
        },
        { transaction: t }
      );
    }

    if (finePaidNow > 0) {
      await ShopTransaction.create(
        {
          type: "collection",
          sourceType: "fine_payment",
          sourceId: installment.id,
          amount: finePaidNow,
          description: `Installment #${installment.installmentNo} fine payment - invoice ${sale.invoiceNo}`,
          transactionDate: todayDate(),
          createdBy: req.user.id,
        },
        { transaction: t }
      );
    }

    if (installmentPaidNow > 0 || finePaidNow > 0) {
      await recalculateShopBalance(t);
    }

    await t.commit();

    let description = `Received installment payment Rs. ${installmentPaidNow} | Fine Rs. ${finePaidNow}`;

    if (reamortizedDelta > 0) {
      description += ` | Excess Rs. ${reamortizedDelta} re-amortized across ${futureInstallments.length} future installment(s)`;
    } else if (reamortizedDelta < 0) {
      description += ` | Shortfall Rs. ${Math.abs(
        reamortizedDelta
      )} carried forward across ${futureInstallments.length} future installment(s)`;
    }

    if (reduceFinalAmount !== null) {
      description += ` | Final sale amount reduced Rs. ${previousFinalAmountForLog} -> Rs. ${reduceFinalAmount}: ${notes}`;
    }

    await logActivity({
      req,
      action: "pay",
      module: "installments",
      recordId: installment.id,
      description,
      newData: {
        installment: installment.toJSON(),
        sale: sale.toJSON(),
        payment: {
          amount: payAmount,
          installmentPaid: installmentPaidNow,
          finePaid: finePaidNow,
          fineDiscount: discountFine,
          excessAmount: reamortizedDelta,
          reamortizedInstallments: futureInstallments.map((inst) =>
            inst.toJSON()
          ),
          priceReduced:
            reduceFinalAmount !== null
              ? {
                  previousFinalAmount: previousFinalAmountForLog,
                  newFinalAmount: reduceFinalAmount,
                }
              : null,
        },
      },
    });

    res.json({
      message: "Installment payment received successfully",
      totalPayable,
      fineCalculated: fineData.fineAmount,
      fineDiscount: discountFine,
      finePaid: finePaidNow,
      installmentPaid: installmentPaidNow,
      excessAmount: reamortizedDelta,
      reamortized: reamortizedDelta !== 0,
      updatedFutureInstallments: futureInstallments,
      priceReduced:
        reduceFinalAmount !== null
          ? {
              previousFinalAmount: previousFinalAmountForLog,
              newFinalAmount: reduceFinalAmount,
            }
          : null,
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
          model: SaleItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
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

// Flat list of every installment sale (with customer + product) for the
// search bar on the Installments page — lets the frontend filter by name,
// mobile, or item without a drill-down per customer.
exports.getAllInstallmentSaleItems = async (req, res) => {
  try {
    const sales = await Sale.findAll({
      where: {
        saleType: "installment",
      },
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
        {
          model: Customer,
          as: "customer",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(sales);
  } catch (error) {
    res.status(500).json({
      message: "Get installment sale items failed",
      error: error.message,
    });
  }
};

// Admin-only fix for a mis-entered payment (wrong amount/fine/date typed in
// at the time). Unlike payInstallment, this does not re-amortize future
// installments — it only corrects this installment and the sale's totals,
// and tells the caller if the future schedule may need a manual look.
exports.correctInstallment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { paidAmount, finePaid, fineDiscount, paidDate, reason } = req.body;

    if (!reason || !String(reason).trim()) {
      await t.rollback();
      return res.status(400).json({
        message: "A reason is required to correct a payment",
      });
    }

    const installment = await Installment.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!installment) {
      await t.rollback();
      return res.status(404).json({ message: "Installment not found" });
    }

    const oldInstallmentSnapshot = installment.toJSON();

    const newPaidAmount =
      paidAmount !== undefined
        ? Number(paidAmount)
        : Number(installment.paidAmount || 0);
    const newFinePaid =
      finePaid !== undefined
        ? Number(finePaid)
        : Number(installment.finePaid || 0);

    if (newPaidAmount < 0 || newFinePaid < 0) {
      await t.rollback();
      return res.status(400).json({ message: "Amounts cannot be negative" });
    }

    if (newPaidAmount > Number(installment.amount || 0)) {
      await t.rollback();
      return res.status(400).json({
        message:
          "Corrected paid amount cannot exceed this installment's amount. Use the normal Pay flow for overpayments that should roll into future installments.",
      });
    }

    const principalDelta = newPaidAmount - Number(installment.paidAmount || 0);
    const fineDelta = newFinePaid - Number(installment.finePaid || 0);

    installment.paidAmount = newPaidAmount;
    installment.finePaid = newFinePaid;

    if (fineDiscount !== undefined) {
      installment.fineDiscount = Number(fineDiscount);
    }

    installment.remainingAmount = Math.max(
      0,
      Number(installment.amount || 0) - newPaidAmount
    );

    installment.status =
      installment.remainingAmount <= 0
        ? "paid"
        : newPaidAmount > 0
        ? "partial"
        : "pending";

    if (paidDate !== undefined) {
      installment.paidDate = paidDate || null;
    } else if (installment.status === "paid" && !installment.paidDate) {
      installment.paidDate = todayDate();
    } else if (newPaidAmount === 0) {
      installment.paidDate = null;
    }

    installment.notes = installment.notes
      ? `${installment.notes} | Corrected by ${req.user.name}: ${reason}`
      : `Corrected by ${req.user.name}: ${reason}`;

    await installment.save({ transaction: t });

    const sale = await Sale.findByPk(installment.saleId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    const oldSaleSnapshot = sale.toJSON();

    sale.paidAmount = Math.max(0, Number(sale.paidAmount || 0) + principalDelta);
    sale.remainingAmount = Math.max(
      0,
      Number(sale.remainingAmount || 0) - principalDelta
    );

    const unpaidInstallments = await Installment.count({
      where: {
        saleId: sale.id,
        status: { [Op.in]: ["pending", "partial"] },
      },
      transaction: t,
    });

    if (sale.remainingAmount <= 0 || unpaidInstallments === 0) {
      sale.remainingAmount = 0;
      sale.status = "cleared";
    } else if (sale.status === "cleared") {
      sale.status = "active";
    }

    const totalPurchase = Number(sale.purchasePrice || 0);
    const totalProfit = Number(sale.profit || 0);

    sale.profitRecovered = Math.max(0, sale.paidAmount - totalPurchase);
    if (sale.profitRecovered > totalProfit) {
      sale.profitRecovered = totalProfit;
    }
    sale.profitPending = Math.max(0, totalProfit - sale.profitRecovered);

    // Heal the cached monthly figure from the untouched future schedule.
    // Only "pending" (nothing paid yet) installments represent the uniform
    // recurring amount — a "partial" one (like the installment we may have
    // just corrected) can carry a one-off amount from an earlier excess
    // absorption, and averaging it in reintroduces a repeating-decimal
    // figure instead of the real monthly rate.
    let scheduleInstallments = await Installment.findAll({
      where: { saleId: sale.id, status: "pending" },
      attributes: ["amount"],
      transaction: t,
      raw: true,
    });

    if (scheduleInstallments.length === 0) {
      scheduleInstallments = await Installment.findAll({
        where: { saleId: sale.id, status: { [Op.in]: ["pending", "partial"] } },
        attributes: ["amount"],
        transaction: t,
        raw: true,
      });
    }

    if (scheduleInstallments.length > 0) {
      const totalScheduleAmount = scheduleInstallments.reduce(
        (sum, i) => sum + Number(i.amount || 0),
        0
      );
      sale.monthlyInstallment = totalScheduleAmount / scheduleInstallments.length;
    }

    await sale.save({ transaction: t });

    await t.commit();

    const description = `Corrected installment #${installment.installmentNo} (sale ${sale.invoiceNo}): paid Rs. ${oldInstallmentSnapshot.paidAmount} → Rs. ${newPaidAmount}, fine Rs. ${oldInstallmentSnapshot.finePaid} → Rs. ${newFinePaid}. Reason: ${reason}`;

    await logActivity({
      req,
      action: "correct",
      module: "installments",
      recordId: installment.id,
      description,
      oldData: { installment: oldInstallmentSnapshot, sale: oldSaleSnapshot },
      newData: {
        installment: installment.toJSON(),
        sale: sale.toJSON(),
        reason,
      },
    });

    res.json({
      message: "Installment corrected successfully",
      installment,
      sale,
      warning:
        principalDelta !== 0
          ? "Sale totals were updated. Future installments were not re-amortized — review the remaining schedule if it should change too."
          : null,
    });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Correction failed",
      error: error.message,
    });
  }
};

exports.getMonthlyCollections = async (req, res) => {
  try {
    const { from, to } = req.query; // optional "YYYY-MM" bounds

    // Advance amounts are paid at sale creation and stored on installment #1,
    // which is never touched again by payInstallment - its paidDate is reliable.
    const advanceInstallments = await Installment.findAll({
      where: {
        installmentNo: 1,
        paidDate: { [Op.ne]: null },
      },
      attributes: ["paidDate", "paidAmount"],
      raw: true,
    });

    // Every later installment/fine payment is logged once per transaction here,
    // since the Installment row itself only keeps cumulative state.
    const paymentLogs = await ActivityLog.findAll({
      where: { module: "installments", action: "pay" },
      attributes: ["createdAt", "newData"],
      raw: true,
    });

    const monthly = {};

    const ensureMonth = (key) => {
      if (!monthly[key]) {
        monthly[key] = { month: key, advance: 0, installment: 0, fine: 0 };
      }
      return monthly[key];
    };

    for (const inst of advanceInstallments) {
      const key = String(inst.paidDate).slice(0, 7);
      ensureMonth(key).advance += Number(inst.paidAmount || 0);
    }

    for (const log of paymentLogs) {
      const key = new Date(log.createdAt).toISOString().slice(0, 7);
      const payment = log.newData?.payment || {};
      const entry = ensureMonth(key);
      const finePaid = Number(payment.finePaid || 0);
      // Derive from amount/finePaid rather than the stored installmentPaid
      // field: older log entries recorded installmentPaid before excess
      // amounts were folded in, so it under-reports on re-amortized payments.
      entry.installment += Number(payment.amount || 0) - finePaid;
      entry.fine += finePaid;
    }

    let months = Object.values(monthly)
      .map((m) => ({ ...m, total: m.advance + m.installment + m.fine }))
      .sort((a, b) => a.month.localeCompare(b.month));

    if (from) months = months.filter((m) => m.month >= from);
    if (to) months = months.filter((m) => m.month <= to);

    const summary = months.reduce(
      (acc, m) => {
        acc.totalAdvance += m.advance;
        acc.totalInstallment += m.installment;
        acc.totalFine += m.fine;
        acc.totalCollected += m.total;
        return acc;
      },
      { totalAdvance: 0, totalInstallment: 0, totalFine: 0, totalCollected: 0 }
    );

    res.json({ summary, months });
  } catch (error) {
    res.status(500).json({
      message: "Monthly collection report failed",
      error: error.message,
    });
  }
};

exports.getDueThisMonth = async (req, res) => {
  try {
    const { month, planMonths } = req.query; // optional "YYYY-MM", defaults to current month; optional installment plan filter (3/6/12)

    const now = new Date();
    const monthKey =
      month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [year, mon] = monthKey.split("-").map(Number);
    const startDate = `${monthKey}-01`;
    const endDate = new Date(year, mon, 0).toISOString().split("T")[0]; // last day of month

    const saleInclude = {
      model: Sale,
      as: "sale",
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
      ],
    };

    if (planMonths) {
      // Restricts to sales on this installment plan duration (e.g. next month's
      // 3/6/12-month plan collections) - requires the join since the filter is on Sale.
      saleInclude.where = { installmentMonths: Number(planMonths) };
      saleInclude.required = true;
    }

    const installments = await Installment.findAll({
      where: {
        dueDate: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      include: [{ model: Customer, as: "customer" }, saleInclude],
      order: [["dueDate", "ASC"]],
    });

    const today = todayDate();

    const data = installments
      // Installment #1 is always the advance paid at sale time (see saleController),
      // not a real monthly due - a customer who just bought this month and paid
      // their advance shouldn't show up in the due list.
      .filter((item) => item.installmentNo !== 1)
      .map((item) => {
        const json = item.toJSON();
        const isPaid = json.status === "paid";
        const isOverdue = !isPaid && json.dueDate < today;
        const planMonthsForSale = json.sale?.installmentMonths;
        const frequency = json.sale?.installmentFrequency;

        const category =
          frequency === "daily"
            ? "Daily"
            : planMonthsForSale === 12
            ? "Yearly"
            : planMonthsForSale === 6
            ? "6 Months"
            : planMonthsForSale === 3
            ? "3 Months"
            : "Other";

        return {
          id: json.id,
          saleId: json.saleId,
          installmentNo: json.installmentNo,
          dueDate: json.dueDate,
          amount: json.amount,
          paidAmount: json.paidAmount,
          remainingAmount: json.remainingAmount,
          status: json.status,
          displayStatus: isPaid ? "paid" : isOverdue ? "overdue" : json.status,
          category,
          customerName: json.customer?.name || "-",
          customerPhone: json.customer?.phone || "-",
          productName: itemsToProductLabel(json.sale?.items),
          invoiceNo: json.sale?.invoiceNo || "-",
        };
      });

    const CATEGORY_ORDER = ["Yearly", "6 Months", "3 Months", "Daily", "Other"];
    const groups = CATEGORY_ORDER.map((category) => {
      const items = data.filter((d) => d.category === category);
      return {
        category,
        count: items.length,
        totalAmount: items.reduce((s, d) => s + Number(d.amount || 0), 0),
        items,
      };
    }).filter((g) => g.count > 0);

    const summary = {
      month: monthKey,
      planMonths: planMonths ? Number(planMonths) : null,
      totalItems: data.length,
      paidCount: data.filter((d) => d.displayStatus === "paid").length,
      unpaidCount: data.filter((d) => d.displayStatus !== "paid").length,
      totalAmount: data.reduce((s, d) => s + Number(d.amount || 0), 0),
      totalCollected: data.reduce((s, d) => s + Number(d.paidAmount || 0), 0),
      totalRemaining: data.reduce(
        (s, d) => s + Number(d.remainingAmount || 0),
        0
      ),
    };

    res.json({ summary, installments: data, groups });
  } catch (error) {
    res.status(500).json({
      message: "Due this month report failed",
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