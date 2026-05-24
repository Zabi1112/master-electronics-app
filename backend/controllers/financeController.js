const { Op, fn, col } = require("sequelize");
const {
  BusinessSetting,
  DonationRecord,
  Sale,
  Partner,
  PartnerTransaction,
  User,
} = require("../models");

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthRange = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);

  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59);

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

    const {
      profitShareMethod,
      donationPercentage,
      donationReminderEnabled,
    } = req.body;

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
    const settings = await getOrCreateSettings();
    const month = req.query.month || currentMonthKey();
    const { start, end } = getMonthRange(month);

    const monthlyProfit = await sumField(Sale, "profitRecovered", {
      createdAt: {
        [Op.gte]: start,
        [Op.lte]: end,
      },
    });

    const donationAmount =
      monthlyProfit * (Number(settings.donationPercentage || 0) / 100);

    let record = await DonationRecord.findOne({
      where: { month },
    });

    if (!record && settings.donationReminderEnabled) {
      record = await DonationRecord.create({
        month,
        profitAmount: monthlyProfit,
        donationPercentage: settings.donationPercentage,
        donationAmount,
        status: "due",
        createdBy: req.user.id,
      });
    }

    res.json({
      month,
      monthlyProfit,
      donationPercentage: settings.donationPercentage,
      donationAmount,
      reminderEnabled: settings.donationReminderEnabled,
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
    const { month, notes } = req.body;

    const targetMonth = month || currentMonthKey();

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
      notes: notes || record.notes,
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
    const settings = await getOrCreateSettings();
    const month = req.query.month || currentMonthKey();
    const { start, end } = getMonthRange(month);

    const monthlyProfit = await sumField(Sale, "profitRecovered", {
      createdAt: {
        [Op.gte]: start,
        [Op.lte]: end,
      },
    });

    const donationAmount =
      monthlyProfit * (Number(settings.donationPercentage || 0) / 100);

    const netProfitAfterDonation = monthlyProfit - donationAmount;

    const partners = await Partner.findAll({
      where: { status: "active" },
    });

    const totalInvestment = partners.reduce(
      (sum, p) => sum + Number(p.totalInvested || 0),
      0
    );

    const shares = partners.map((partner) => {
      let percentage = 0;

      if (settings.profitShareMethod === "equal") {
        percentage = partners.length ? 100 / partners.length : 0;
      } else {
        percentage = totalInvestment
          ? (Number(partner.totalInvested || 0) / totalInvestment) * 100
          : 0;
      }

      const profitShare = netProfitAfterDonation * (percentage / 100);

      const calculatedBalance =
        Number(partner.totalInvested || 0) +
        Number(profitShare || 0) -
        Number(partner.totalWithdrawn || 0) -
        Number(partner.lossShare || 0);

      return {
        partnerId: partner.id,
        partnerName: partner.name,
        totalInvested: partner.totalInvested,
        totalWithdrawn: partner.totalWithdrawn,
        lossShare: partner.lossShare,
        percentage,
        profitShare,
        calculatedBalance,
      };
    });

    res.json({
      month,
      method: settings.profitShareMethod,
      grossProfit: monthlyProfit,
      donationPercentage: settings.donationPercentage,
      donationAmount,
      netProfitAfterDonation,
      totalInvestment,
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
  try {
    const month = req.body.month || currentMonthKey();

    const calculationReq = {
      query: { month },
    };

    const settings = await getOrCreateSettings();
    const { start, end } = getMonthRange(month);

    const monthlyProfit = await sumField(Sale, "profitRecovered", {
      createdAt: {
        [Op.gte]: start,
        [Op.lte]: end,
      },
    });

    const partners = await Partner.findAll({
      where: { status: "active" },
    });

    const totalInvestment = partners.reduce(
      (sum, p) => sum + Number(p.totalInvested || 0),
      0
    );

    for (const partner of partners) {
      let percentage = 0;

      if (settings.profitShareMethod === "equal") {
        percentage = partners.length ? 100 / partners.length : 0;
      } else {
        percentage = totalInvestment
          ? (Number(partner.totalInvested || 0) / totalInvestment) * 100
          : 0;
      }

      const shareAmount = monthlyProfit * (percentage / 100);

      if (shareAmount > 0) {
        await PartnerTransaction.create({
          partnerId: partner.id,
          type: "profit_credit",
          amount: Math.round(shareAmount),
          description: `Profit share for ${month} (${settings.profitShareMethod})`,
          transactionDate: new Date().toISOString().split("T")[0],
          createdBy: req.user.id,
        });
      }
    }

    res.json({
      message: "Partner profit shares credited successfully",
      month,
      method: settings.profitShareMethod,
      monthlyProfit,
    });
  } catch (error) {
    res.status(500).json({
      message: "Credit partner profit shares failed",
      error: error.message,
    });
  }
};