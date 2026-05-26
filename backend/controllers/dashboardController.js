const { Op, fn, col } = require("sequelize");
const { Product, Sale, Installment, Partner, DonationRecord, Expense} = require("../models");
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

    const products = await Product.findAll({ raw: true });

    const currentInventoryValue = products.reduce((sum, p) => {
      if (p.status === "in_stock") {
        return sum + Number(p.purchasePrice || 0) * Number(p.quantity || 0);
      }
      return sum;
    }, 0);

    const expectedInventorySaleValue = products.reduce((sum, p) => {
      if (p.status === "in_stock") {
        return sum + Number(p.salePrice || 0) * Number(p.quantity || 0);
      }
      return sum;
    }, 0);

    const soldInventoryCost = await sumField(Sale, "purchasePrice");

    const totalInventoryPurchased =
      Number(currentInventoryValue || 0) + Number(soldInventoryCost || 0);

    const totalPartnerInvestment = await sumField(Partner, "totalInvested");
    const totalPartnerWithdrawals = await sumField(Partner, "totalWithdrawn");
    const totalPartnerBalance = await sumField(Partner, "currentBalance");

    const totalDonationPaid = await sumField(DonationRecord, "donationAmount", {
      status: "paid",
    });

    const totalExpenses = await sumField(Expense, "amount");

    const totalSales = await sumField(Sale, "finalAmount");
    const cashSales = await sumField(Sale, "finalAmount", { saleType: "cash" });
    const installmentSales = await sumField(Sale, "finalAmount", {
      saleType: "installment",
    });

    const totalRegained = await sumField(Sale, "paidAmount");
    const totalProfit = await sumField(Sale, "profit");
    const profitRecovered = await sumField(Sale, "profitRecovered");
    const profitPending = await sumField(Sale, "profitPending");

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

    const amountCirclingInstallments = await sumField(Sale, "remainingAmount", {
      saleType: "installment",
      status: { [Op.in]: ["active", "cleared"] },
    });

    const recoveredInstallments = await sumField(Sale, "paidAmount", {
      saleType: "installment",
    });

    const overdueAmount = await sumField(Installment, "remainingAmount", {
      dueDate: { [Op.lt]: today },
      status: { [Op.in]: ["pending", "partial"] },
    });

    const pendingInstallmentAmount = await sumField(
      Installment,
      "remainingAmount",
      {
        status: { [Op.in]: ["pending", "partial"] },
      }
    );

    const totalProducts = await Product.count();

    const inStockProducts = await Product.count({
      where: { status: "in_stock" },
    });

    const soldProducts = await Product.count({
      where: { status: "sold" },
    });

    const activeInstallmentSales = await Sale.count({
      where: { saleType: "installment", status: "active" },
    });

    const clearedInstallmentSales = await Sale.count({
      where: { saleType: "installment", status: "cleared" },
    });

    const overdueInstallmentsCount = await Installment.count({
      where: {
        dueDate: { [Op.lt]: today },
        status: { [Op.in]: ["pending", "partial"] },
      },
    });

    res.json({
      finance: {
        totalCapital: totalPartnerInvestment,
        partnerWithdrawals: totalPartnerWithdrawals,
        donationPaid: totalDonationPaid,
        totalExpenses,
        inventoryPurchased: totalInventoryPurchased,
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
    });
  } catch (error) {
    res.status(500).json({
      message: "Dashboard stats failed",
      error: error.message,
    });
  }
};