/*
 * Corrects the "Historical inventory purchase" PartnerTransaction entries
 * created by backfillFundingSource.js. That script used purchasePrice *
 * Product.quantity, but Product.quantity is REMAINING stock (decremented on
 * every sale), not the original quantity purchased — so it both phantom
 * inflated fully-sold-out products (via a `quantity || 1` bug) and ignored
 * the cost of anything already sold (tracked on Sale.purchasePrice instead
 * of the Product row).
 *
 * Correct amount per product = purchasePrice * currentQuantity
 *                               + SUM(Sale.purchasePrice for that product)
 * (matches the dashboard's own totalInventoryPurchased formula).
 *
 * Usage:
 *   node backend/scripts/fixHistoricalInventoryAmounts.js            (dry run)
 *   node backend/scripts/fixHistoricalInventoryAmounts.js --commit   (writes changes)
 */

const dotenv = require("dotenv");
dotenv.config();

const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

const run = async () => {
  const commit = process.argv.includes("--commit");

  await sequelize.authenticate();
  const { Product, Sale, PartnerTransaction } = require("../models");
  const { recalculatePartnerBalance } = require("../controllers/partnerController");

  const products = await Product.findAll({
    where: { partnerTransactionId: { [require("sequelize").Op.ne]: null } },
  });

  let totalOld = 0;
  let totalNew = 0;
  const corrections = [];

  for (const product of products) {
    const trx = await PartnerTransaction.findByPk(product.partnerTransactionId);
    if (!trx) continue;

    const soldCost = await Sale.sum("purchasePrice", {
      where: { productId: product.id },
    });

    const correctAmount =
      Number(product.purchasePrice || 0) * Number(product.quantity || 0) +
      Number(soldCost || 0);

    totalOld += Number(trx.amount || 0);
    totalNew += correctAmount;

    if (Math.round(Number(trx.amount)) !== Math.round(correctAmount)) {
      corrections.push({ product, trx, correctAmount });
    }
  }

  console.log(`Products checked: ${products.length}`);
  console.log(`Products needing correction: ${corrections.length}`);
  console.log(`Old total: Rs. ${totalOld}`);
  console.log(`Correct total: Rs. ${totalNew}`);
  console.log(`Delta: Rs. ${totalNew - totalOld}`);

  if (!commit) {
    console.log("\nSample corrections (up to 10):");
    corrections.slice(0, 10).forEach((c) => {
      console.log(
        `  ${c.product.productName}: Rs. ${c.trx.amount} -> Rs. ${c.correctAmount}`
      );
    });
    console.log("\nDry run only — no changes written. Re-run with --commit to apply.");
    return;
  }

  const t = await sequelize.transaction();
  const partnerIds = new Set();

  try {
    for (const { trx, correctAmount, product } of corrections) {
      await trx.update({ amount: correctAmount }, { transaction: t });
      if (product.partnerId) partnerIds.add(product.partnerId);
    }

    for (const partnerId of partnerIds) {
      await recalculatePartnerBalance(partnerId, t);
    }

    await t.commit();

    console.log(`\nDone. Corrected ${corrections.length} transactions.`);
  } catch (error) {
    await t.rollback();
    console.error("Correction failed, rolled back:", error.message);
    process.exitCode = 1;
  }
};

run()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
