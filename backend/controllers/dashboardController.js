const { Op, fn, col } = require("sequelize");
const { Product, ProductBatch, Sale, Installment, Partner, DonationRecord, Expense} = require("../models");
const { getOrCreateShopAccount } = require("./shopAccountController");
// only destructure what that specific controller needs

const sumField = async (Model, field, where = {}) => {
  const result = await Model.findOne({
    attributes: [[fn("SUM", col(field)), "total"]],
    where,
    raw: true,
  });

  return Number(result.total || 0);
};

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // All of these are independent reads — none depends on another's
    // result — so they're fired together instead of one-by-one. Run
    // sequentially this was ~24 separate round-trips to the DB (measured
    // ~13s in production), which was blowing past the serverless function
    // timeout and hogging the connection pool while other pages' requests
    // queued behind it.
    const [
      inStockBatches,
      soldInventoryCost,
      totalPartnerInvestment,
      totalPartnerWithdrawals,
      totalPartnerBalance,
      totalDonationPaid,
      totalExpenses,
      totalSales,
      cashSales,
      installmentSales,
      totalRegained,
      totalProfit,
      profitRecovered,
      profitPending,
      amountCirclingInstallments,
      recoveredInstallments,
      overdueAmount,
      pendingInstallmentAmount,
      shopAccount,
      totalProducts,
      inStockProducts,
      soldProducts,
      activeInstallmentSales,
      clearedInstallmentSales,
      overdueInstallmentsCount,
    ] = await Promise.all([
      ProductBatch.findAll({
        where: { remainingQuantity: { [Op.gt]: 0 } },
        include: [{ model: Product, as: "product", attributes: ["salePrice"] }],
      }),
      sumField(Sale, "purchasePrice"),
      sumField(Partner, "totalInvested"),
      sumField(Partner, "totalWithdrawn"),
      sumField(Partner, "currentBalance"),
      sumField(DonationRecord, "donationAmount", { status: "paid" }),
      sumField(Expense, "amount"),
      sumField(Sale, "finalAmount"),
      sumField(Sale, "finalAmount", { saleType: "cash" }),
      sumField(Sale, "finalAmount", { saleType: "installment" }),
      sumField(Sale, "paidAmount"),
      sumField(Sale, "profit"),
      sumField(Sale, "profitRecovered"),
      sumField(Sale, "profitPending"),
      sumField(Sale, "remainingAmount", {
        saleType: "installment",
        status: { [Op.in]: ["active", "cleared"] },
      }),
      sumField(Sale, "paidAmount", { saleType: "installment" }),
      sumField(Installment, "remainingAmount", {
        dueDate: { [Op.lt]: today },
        status: { [Op.in]: ["pending", "partial"] },
      }),
      sumField(Installment, "remainingAmount", {
        status: { [Op.in]: ["pending", "partial"] },
      }),
      getOrCreateShopAccount(),
      Product.count(),
      Product.count({ where: { status: "in_stock" } }),
      Product.count({ where: { status: "sold" } }),
      Sale.count({ where: { saleType: "installment", status: "active" } }),
      Sale.count({ where: { saleType: "installment", status: "cleared" } }),
      Installment.count({
        where: {
          dueDate: { [Op.lt]: today },
          status: { [Op.in]: ["pending", "partial"] },
        },
      }),
    ]);

    const currentInventoryValue = inStockBatches.reduce(
      (sum, b) => sum + Number(b.remainingQuantity || 0) * Number(b.purchasePrice || 0),
      0
    );

    const expectedInventorySaleValue = inStockBatches.reduce(
      (sum, b) =>
        sum + Number(b.remainingQuantity || 0) * Number(b.product?.salePrice || 0),
      0
    );

    const totalInventoryPurchased =
      Number(currentInventoryValue || 0) + Number(soldInventoryCost || 0);

    const totalSpent =
      Number(totalInventoryPurchased || 0) + Number(totalExpenses || 0);

    const netProfitAfterExpenses =
      Number(profitRecovered || 0) -
      Number(totalDonationPaid || 0) -
      Number(totalExpenses || 0);

    const availableCapital =
      Number(totalPartnerInvestment || 0) -
      Number(totalPartnerWithdrawals || 0) -
      Number(totalInventoryPurchased || 0) +
      Number(totalRegained || 0) -
      Number(totalDonationPaid || 0) -
      Number(totalExpenses || 0);

    res.json({
      finance: {
        totalCapital: totalPartnerInvestment,
        partnerWithdrawals: totalPartnerWithdrawals,
        donationPaid: totalDonationPaid,
        totalExpenses,
        inventoryPurchased: totalInventoryPurchased,
        totalSpent,
        availableCapital,
        totalRegained,
        netProfitAfterExpenses,
      },

      sales: {
        totalSales,
        cashSales,
        installmentSales,
        totalProfit,
        profitRecovered,
        profitPending,
      },

      installments: {
        amountCirclingInstallments,
        recoveredInstallments,
        pendingInstallmentAmount,
        overdueAmount,
        activeInstallmentSales,
        clearedInstallmentSales,
        overdueInstallmentsCount,
      },

      inventory: {
        inventoryValue: currentInventoryValue,
        expectedInventorySaleValue,
        totalProducts,
        inStockProducts,
        soldProducts,
      },

      partners: {
        totalPartnerInvestment,
        totalPartnerWithdrawals,
        totalPartnerBalance,
      },

      shopAccount: {
        totalCollected: shopAccount.totalCollected,
        totalRecycled: shopAccount.totalUsed,
        currentBalance: shopAccount.currentBalance,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Dashboard stats failed",
      error: error.message,
    });
  }
};