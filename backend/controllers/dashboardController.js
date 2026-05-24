const { Op, fn, col } = require("sequelize");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Installment = require("../models/Installment");
const Partner = require("../models/Partner");

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

    const totalSales = await sumField(Sale, "finalAmount");
    const cashSales = await sumField(Sale, "finalAmount", { saleType: "cash" });
    const installmentSales = await sumField(Sale, "finalAmount", {
      saleType: "installment",
    });

    const totalInvested = await sumField(Sale, "purchasePrice");
    const totalRegained = await sumField(Sale, "paidAmount");
    const totalProfit = await sumField(Sale, "profit");
    const profitRecovered = await sumField(Sale, "profitRecovered");
    const profitPending = await sumField(Sale, "profitPending");

    const amountCirclingInstallments = await sumField(Sale, "remainingAmount", {
      saleType: "installment",
      status: {
        [Op.in]: ["active", "cleared"],
      },
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

    const todayCollection = await sumField(Sale, "paidAmount", {
      createdAt: {
        [Op.gte]: new Date(`${today}T00:00:00`),
        [Op.lte]: new Date(`${today}T23:59:59`),
      },
    });

    const inventoryValue = await sumField(Product, "purchasePrice", {
      status: "in_stock",
    });

    const totalProducts = await Product.count();
    const inStockProducts = await Product.count({ where: { status: "in_stock" } });
    const soldProducts = await Product.count({ where: { status: "sold" } });

    const totalPartnerInvestment = await sumField(Partner, "totalInvested");
    const totalPartnerWithdrawals = await sumField(Partner, "totalWithdrawn");
    const totalPartnerBalance = await sumField(Partner, "currentBalance");

    const activeInstallmentSales = await Sale.count({
      where: { saleType: "installment", status: "active" },
    });

    const overdueInstallmentsCount = await Installment.count({
      where: {
        dueDate: { [Op.lt]: today },
        status: { [Op.in]: ["pending", "partial"] },
      },
    });

    res.json({
      sales: {
        totalSales,
        cashSales,
        installmentSales,
        totalInvested,
        totalRegained,
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
        overdueInstallmentsCount,
      },

      inventory: {
        inventoryValue,
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