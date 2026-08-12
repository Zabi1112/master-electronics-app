/*
 * Idempotent backfill: every Sale that predates the SaleItem (multi-item
 * sale) feature has no line-item rows yet. This creates exactly one
 * SaleItem per such sale, mirroring its current productId/quantity/pricing
 * fields, so every downstream read path can uniformly go through
 * `sale.items` instead of the old single-product `sale.product` — for both
 * old and new sales alike. Safe to run repeatedly — sales that already have
 * at least one item are skipped.
 *
 * Invoked automatically on every server boot (backend/server.js), and can
 * also be run standalone:
 *   node backend/scripts/backfillSaleItems.js
 */

const backfillSaleItems = async () => {
  const { Sale, SaleItem } = require("../models");
  const { Op } = require("sequelize");

  const existingItemSaleIds = await SaleItem.findAll({
    attributes: ["saleId"],
    group: ["saleId"],
    raw: true,
  }).then((rows) => rows.map((r) => r.saleId));

  const where = existingItemSaleIds.length
    ? { id: { [Op.notIn]: existingItemSaleIds } }
    : {};

  const sales = await Sale.findAll({ where });

  if (!sales.length) {
    return { migrated: 0 };
  }

  for (const sale of sales) {
    await SaleItem.create({
      saleId: sale.id,
      productId: sale.productId,
      productBatchId: sale.productBatchId || null,
      quantity: Number(sale.quantity || 1),
      purchasePrice: Number(sale.purchasePrice || 0),
      cashPrice: Number(sale.cashPrice || 0),
      installmentPrice: Number(sale.installmentPrice || 0),
      salePrice: Number(sale.salePrice || 0),
      discountShare: Number(sale.discount || 0),
      finalAmount: Number(sale.finalAmount || 0),
      profit: Number(sale.profit || 0),
    });
  }

  return { migrated: sales.length };
};

module.exports = { backfillSaleItems };

if (require.main === module) {
  const dotenv = require("dotenv");
  dotenv.config();

  const { getSequelize } = require("../config/db");
  const sequelize = getSequelize();

  sequelize
    .authenticate()
    .then(() => backfillSaleItems())
    .then(({ migrated }) => {
      console.log(`Backfilled sale items for ${migrated} sale(s).`);
      process.exit();
    })
    .catch((error) => {
      console.error("Backfill failed:", error.message);
      process.exit(1);
    });
}
