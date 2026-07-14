/*
 * Idempotent backfill: every Product predates the ProductBatch (restock/lot
 * tracking) feature has no batch rows yet. This creates exactly one batch per
 * such product, mirroring its current purchasePrice/quantity/funding fields
 * and RELINKING (not recreating) its existing funding transaction ids, so no
 * duplicate ledger entries are booked. Safe to run repeatedly — products that
 * already have at least one batch are skipped.
 *
 * Invoked automatically on every server boot (backend/server.js), and can
 * also be run standalone:
 *   node backend/scripts/backfillProductBatches.js
 */

const backfillProductBatches = async () => {
  const { Product, ProductBatch } = require("../models");
  const { Op } = require("sequelize");

  const existingBatchProductIds = await ProductBatch.findAll({
    attributes: ["productId"],
    group: ["productId"],
    raw: true,
  }).then((rows) => rows.map((r) => r.productId));

  const where = existingBatchProductIds.length
    ? { id: { [Op.notIn]: existingBatchProductIds } }
    : {};

  const products = await Product.findAll({ where });

  if (!products.length) {
    return { migrated: 0 };
  }

  for (const product of products) {
    await ProductBatch.create({
      productId: product.id,
      quantity: Number(product.quantity || 0),
      remainingQuantity: Number(product.quantity || 0),
      purchasePrice: Number(product.purchasePrice || 0),
      purchaseDate: (product.createdAt || new Date()).toISOString().split("T")[0],
      fundingSource: product.fundingSource || null,
      partnerId: product.partnerId || null,
      partnerTransactionId: product.partnerTransactionId || null,
      investorId: product.investorId || null,
      investorTransactionId: product.investorTransactionId || null,
      shopTransactionId: product.shopTransactionId || null,
      createdBy: product.addedBy || null,
    });
  }

  return { migrated: products.length };
};

module.exports = { backfillProductBatches };

if (require.main === module) {
  const dotenv = require("dotenv");
  dotenv.config();

  const { getSequelize } = require("../config/db");
  const sequelize = getSequelize();

  sequelize
    .authenticate()
    .then(() => backfillProductBatches())
    .then(({ migrated }) => {
      console.log(`Backfilled batches for ${migrated} product(s).`);
      process.exit();
    })
    .catch((error) => {
      console.error("Backfill failed:", error.message);
      process.exit(1);
    });
}
