const { PartnerTransaction, ShopTransaction } = require("../models");
const { recalculatePartnerBalance } = require("../controllers/partnerController");
const { recalculateShopBalance } = require("../controllers/shopAccountController");

// Books a purchase/expense against either a partner's ledger (as an
// investment) or the shop's recovered-money ledger (as a usage), and keeps
// the relevant balance in sync. Returns the ids to store back on the
// Product/Expense row so it can be updated/removed later.
const createFundingEntry = async ({
  fundingSource,
  partnerId,
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

    return { partnerTransactionId: trx.id, shopTransactionId: null };
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

    return { partnerTransactionId: null, shopTransactionId: trx.id };
  }

  return { partnerTransactionId: null, shopTransactionId: null };
};

const removeFundingEntry = async ({
  partnerId,
  partnerTransactionId,
  shopTransactionId,
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

  if (shopTransactionId) {
    await ShopTransaction.destroy({
      where: { id: shopTransactionId },
      transaction,
    });

    await recalculateShopBalance(transaction);
  }
};

module.exports = { createFundingEntry, removeFundingEntry };
