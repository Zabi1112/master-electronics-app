const { Op, fn, col } = require("sequelize");
const {
  BusinessSetting,
  DonationRecord,
  Sale,
  Partner,
  Expense,
  User,
} = require("../models");

const monthKey = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const currentMonthKey = () => monthKey(new Date());

const previousMonthKey = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
};

const getMonthRange = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);

  const start = new Date(year, monthNumber - 1, 1, 0, 0, 0);
  const end = new Date(year, monthNumber, 0, 23, 59, 59);

  return { start, end };
};

const sumField = async (Model, field, where = {}) => {
  const result = await Model.findOne({
    attributes: [[fn("SUM", col(field)), "total"]],
    where,
    raw: true,
  });

  return Number(result.total || 0);
};

const getOrCreateSettings = async () => {
  let settings = await BusinessSetting.findByPk(1);

  if (!settings) {
    settings = await BusinessSetting.create({
      id: 1,
      profitShareMethod: "investment_based",
      donationPercentage: 2.5,
      donationReminderEnabled: true,
    });
  }

  return settings;
};

const getMonthlyFinance = async (month) => {
  const settings = await getOrCreateSettings();
  const { start, end } = getMonthRange(month);

  const grossProfit = await sumField(Sale, "profitRecovered", {
    createdAt: {
      [Op.gte]: start,
      [Op.lte]: end,
    },
  });

  const monthlyExpenses = await sumField(Expense, "amount", {
    expenseDate: {
      [Op.gte]: start.toISOString().split("T")[0],
      [Op.lte]: end.toISOString().split("T")[0],
    },
  });

  const profitBeforeDonation = Math.max(
    0,
    Number(grossProfit || 0) - Number(monthlyExpenses || 0)
  );

  const donationAmount =
    profitBeforeDonation * (Number(settings.donationPercentage || 0) / 100);

  const netProfitAfterDonation = profitBeforeDonation - donationAmount;

  return {
    settings,
    month,
    grossProfit,
    monthlyExpenses,
    profitBeforeDonation,
    donationPercentage: settings.donationPercentage,
    donationAmount,
    netProfitAfterDonation,
  };
};

const calculateSharesForMonth = async (month) => {
  const monthly = await getMonthlyFinance(month);

  const partners = await Partner.findAll({
    where: { status: "active" },
  });

  const totalInvestment = partners.reduce(
    (sum, p) => sum + Number(p.totalInvested || 0),
    0
  );

  const shares = partners.map((partner) => {
    let percentage = 0;

    if (monthly.settings.profitShareMethod === "equal") {
      percentage = partners.length ? 100 / partners.length : 0;
    } else {
      percentage = totalInvestment
        ? (Number(partner.totalInvested || 0) / totalInvestment) * 100
        : 0;
    }

    const profitShare =
      Number(monthly.netProfitAfterDonation || 0) * (percentage / 100);

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      totalInvested: Number(partner.totalInvested || 0),
      totalWithdrawn: Number(partner.totalWithdrawn || 0),
      lossShare: Number(partner.lossShare || 0),
      percentage,
      profitShare,
    };
  });

  return {
    ...monthly,
    method: monthly.settings.profitShareMethod,
    totalInvestment,
    shares,
  };
};

const calculatePartnerAllTimeBalances = async (targetMonth) => {
  const partners = await Partner.findAll({
    where: { status: "active" },
  });

  const now = new Date();
  const currentMonth = targetMonth || currentMonthKey();

  const allSales = await Sale.findAll({
    attributes: ["createdAt"],
    raw: true,
  });

  const monthsSet = new Set();

  allSales.forEach((sale) => {
    const d = new Date(sale.createdAt);
    const key = monthKey(d);
    if (key <= currentMonth) monthsSet.add(key);
  });

  const months = [...monthsSet].sort();

  const monthlySharesMap = {};

  for (const month of months) {
    const calc = await calculateSharesForMonth(month);

    calc.shares.forEach((share) => {
      if (!monthlySharesMap[share.partnerId]) {
        monthlySharesMap[share.partnerId] = {
          totalProfitShare: 0,
          months: [],
        };
      }

      monthlySharesMap[share.partnerId].totalProfitShare += Number(
        share.profitShare || 0
      );

      monthlySharesMap[share.partnerId].months.push({
        month,
        profitShare: share.profitShare,
        percentage: share.percentage,
        grossProfit: calc.grossProfit,
        expenses: calc.monthlyExpenses,
        donation: calc.donationAmount,
        netProfit: calc.netProfitAfterDonation,
      });
    });
  }

  return partners.map((partner) => {
    const shareInfo = monthlySharesMap[partner.id] || {
      totalProfitShare: 0,
      months: [],
    };

    const calculatedBalance =
      Number(partner.totalInvested || 0) +
      Number(shareInfo.totalProfitShare || 0) -
      Number(partner.totalWithdrawn || 0) -
      Number(partner.lossShare || 0);

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      totalInvested: Number(partner.totalInvested || 0),
      totalWithdrawn: Number(partner.totalWithdrawn || 0),
      lossShare: Number(partner.lossShare || 0),
      totalProfitShare: shareInfo.totalProfitShare,
      calculatedBalance,
      monthlyProfitHistory: shareInfo.months,
    };
  });
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({
      message: "Get settings failed",
      error: error.message,
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    const { profitShareMethod, donationPercentage, donationReminderEnabled } =
      req.body;

    await settings.update({
      profitShareMethod: profitShareMethod || settings.profitShareMethod,
      donationPercentage:
        donationPercentage !== undefined
          ? Number(donationPercentage)
          : settings.donationPercentage,
      donationReminderEnabled:
        typeof donationReminderEnabled === "boolean"
          ? donationReminderEnabled
          : settings.donationReminderEnabled,
    });

    res.json({
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    res.status(500).json({
      message: "Update settings failed",
      error: error.message,
    });
  }
};

exports.getCurrentDonationDue = async (req, res) => {
  try {
    const month = req.query.month || previousMonthKey();
    const monthly = await getMonthlyFinance(month);

    let record = await DonationRecord.findOne({
      where: { month },
    });

    if (!record && monthly.settings.donationReminderEnabled) {
      record = await DonationRecord.create({
        month,
        profitAmount: monthly.profitBeforeDonation,
        donationPercentage: monthly.donationPercentage,
        donationAmount: monthly.donationAmount,
        status: "due",
        createdBy: req.user.id,
      });
    }

    res.json({
      month,
      grossProfit: monthly.grossProfit,
      monthlyExpenses: monthly.monthlyExpenses,
      profitBeforeDonation: monthly.profitBeforeDonation,
      donationPercentage: monthly.donationPercentage,
      donationAmount: monthly.donationAmount,
      netProfitAfterDonation: monthly.netProfitAfterDonation,
      reminderEnabled: monthly.settings.donationReminderEnabled,
      record,
      isDue: record?.status === "due",
    });
  } catch (error) {
    res.status(500).json({
      message: "Get donation due failed",
      error: error.message,
    });
  }
};

exports.markDonationPaid = async (req, res) => {
  try {
    const targetMonth = req.body.month || previousMonthKey();

    let record = await DonationRecord.findOne({
      where: { month: targetMonth },
    });

    if (!record) {
      return res.status(404).json({
        message: "Donation record not found",
      });
    }

    await record.update({
      status: "paid",
      paidDate: new Date().toISOString().split("T")[0],
      notes: req.body.notes || record.notes,
      markedPaidBy: req.user.id,
    });

    res.json({
      message: "Donation marked as paid",
      record,
    });
  } catch (error) {
    res.status(500).json({
      message: "Mark donation paid failed",
      error: error.message,
    });
  }
};

exports.getDonationRecords = async (req, res) => {
  try {
    const records = await DonationRecord.findAll({
      include: [
        {
          model: User,
          as: "createdUser",
          attributes: ["id", "name", "username", "role"],
        },
        {
          model: User,
          as: "paidByUser",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["month", "DESC"]],
    });

    res.json(records);
  } catch (error) {
    res.status(500).json({
      message: "Get donation records failed",
      error: error.message,
    });
  }
};

exports.calculatePartnerProfitShares = async (req, res) => {
  try {
    const month = req.query.month || previousMonthKey();
    const monthCalculation = await calculateSharesForMonth(month);
    const allTimeBalances = await calculatePartnerAllTimeBalances(month);

    const shares = monthCalculation.shares.map((share) => {
      const balance = allTimeBalances.find(
        (b) => String(b.partnerId) === String(share.partnerId)
      );

      return {
        ...share,
        monthlyProfitShare: share.profitShare,
        totalProfitShare: balance?.totalProfitShare || 0,
        calculatedBalance: balance?.calculatedBalance || 0,
        monthlyProfitHistory: balance?.monthlyProfitHistory || [],
      };
    });

    res.json({
      month,
      method: monthCalculation.method,
      grossProfit: monthCalculation.grossProfit,
      monthlyExpenses: monthCalculation.monthlyExpenses,
      profitBeforeDonation: monthCalculation.profitBeforeDonation,
      donationPercentage: monthCalculation.donationPercentage,
      donationAmount: monthCalculation.donationAmount,
      netProfitAfterDonation: monthCalculation.netProfitAfterDonation,
      totalInvestment: monthCalculation.totalInvestment,
      shares,
    });
  } catch (error) {
    res.status(500).json({
      message: "Calculate partner profit shares failed",
      error: error.message,
    });
  }
};

exports.creditPartnerProfitShares = async (req, res) => {
  res.status(400).json({
    message:
      "Manual credit is disabled. Partner profit shares are calculated automatically month-wise.",
  });
};