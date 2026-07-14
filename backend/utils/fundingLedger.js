const { PartnerTransaction, ShopTransaction, InvestorTransaction } = require("../models");
const { recalculatePartnerBalance } = require("../controllers/partnerController");
const { recalculateShopBalance } = require("../controllers/shopAccountController");
const { recalculateInvestorBalance } = require("../controllers/investorController");

// Books a purchase/expense against either a partner's ledger (as an
// investment) or the shop's recovered-money ledger (as a usage), and keeps
// the relevant balance in sync. Returns the ids to store back on the
// Product/Expense row so it can be updated/removed later.
const createFundingEntry = async ({
  fundingSource,
  partnerId,
  investorId,
  amount,
  description,
  transactionDate,
  sourceType,
  sourceId,
  createdBy,
  transaction,
}) => {
  if (fundingSource === "partner") {
    const trx = await PartnerTransaction.create(
      {
        partnerId,
        type: "investment",
        amount,
        description,
        transactionDate,
        createdBy,
      },
      { transaction }
    );

    await recalculatePartnerBalance(partnerId, transaction);

    return { partnerTransactionId: trx.id, shopTransactionId: null, investorTransactionId: null };
  }

  if (fundingSource === "investor") {
    const trx = await InvestorTransaction.create(
      {
        investorId,
        type: "investment",
        amount,
        description,
        transactionDate,
        createdBy,
      },
      { transaction }
    );

    await recalculateInvestorBalance(investorId, transaction);

    return { partnerTransactionId: null, shopTransactionId: null, investorTransactionId: trx.id };
  }

  if (fundingSource === "shop") {
    const trx = await ShopTransaction.create(
      {
        type: "usage",
        sourceType,
        sourceId,
        amount,
        description,
        transactionDate,
        createdBy,
      },
      { transaction }
    );

    await recalculateShopBalance(transaction);

    return { partnerTransactionId: null, shopTransactionId: trx.id, investorTransactionId: null };
  }

  return { partnerTransactionId: null, shopTransactionId: null, investorTransactionId: null };
};

const removeFundingEntry = async ({
  partnerId,
  partnerTransactionId,
  shopTransactionId,
  investorId,
  investorTransactionId,
  transaction,
}) => {
  if (partnerTransactionId) {
    await PartnerTransaction.destroy({
      where: { id: partnerTransactionId },
      transaction,
    });

    if (partnerId) {
      await recalculatePartnerBalance(partnerId, transaction);
    }
  }

  if (investorTransactionId) {
    await InvestorTransaction.destroy({
      where: { id: investorTransactionId },
      transaction,
    });

    if (investorId) {
      await recalculateInvestorBalance(investorId, transaction);
    }
  }

  if (shopTransactionId) {
    await ShopTransaction.destroy({
      where: { id: shopTransactionId },
      transaction,
    });

    await recalculateShopBalance(transaction);
  }
};

module.exports = { createFundingEntry, removeFundingEntry };
