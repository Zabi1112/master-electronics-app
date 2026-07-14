/*
 * One-time backfill: books historical money already collected via sales and
 * installment payments into the Shop Account ledger as "collection"
 * ShopTransactions. Needed because saleController.createSale and
 * installmentController.payInstallment only book a collection for sales/
 * payments made AFTER this feature existed — anything recorded before that
 * has no Shop Account entry at all.
 *
 * For each source row, it checks whether a matching ShopTransaction
 * (by sourceType + sourceId) already exists before creating one, so this is
 * safe to re-run — already-covered sales/installments are skipped.
 *
 * Usage:
 *   node backend/scripts/backfillShopCollections.js            (dry run)
 *   node backend/scripts/backfillShopCollections.js --commit   (writes changes)
 */

const dotenv = require("dotenv");
dotenv.config();

const { Op } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

const run = async () => {
  const commit = process.argv.includes("--commit");

  await sequelize.authenticate();
  const { Sale, Installment, ShopTransaction } = require("../models");
  const { recalculateShopBalance } = require("../controllers/shopAccountController");

  const alreadyCovered = async (sourceType, sourceId) => {
    const existing = await ShopTransaction.findOne({
      where: { sourceType, sourceId },
    });
    return Boolean(existing);
  };

  const toCreate = [];

  const cashSales = await Sale.findAll({ where: { saleType: "cash" } });
  for (const sale of cashSales) {
    const amount = Number(sale.paidAmount || 0);
    if (amount > 0 && !(await alreadyCovered("cash_sale", sale.id))) {
      toCreate.push({
        type: "collection",
        sourceType: "cash_sale",
        sourceId: sale.id,
        amount,
        description: `Historical cash sale - invoice ${sale.invoiceNo}`,
        transactionDate: sale.createdAt.toISOString().split("T")[0],
      });
    }
  }

  const installmentSales = await Sale.findAll({ where: { saleType: "installment" } });
  for (const sale of installmentSales) {
    const amount = Number(sale.advanceAmount || 0);
    if (amount > 0 && !(await alreadyCovered("advance_payment", sale.id))) {
      toCreate.push({
        type: "collection",
        sourceType: "advance_payment",
        sourceId: sale.id,
        amount,
        description: `Historical advance payment - invoice ${sale.invoiceNo}`,
        transactionDate: sale.createdAt.toISOString().split("T")[0],
      });
    }
  }

  const laterInstallments = await Installment.findAll({
    where: { installmentNo: { [Op.gt]: 1 } },
    include: [{ model: Sale, as: "sale" }],
  });

  for (const inst of laterInstallments) {
    const principal = Number(inst.paidAmount || 0);
    const date = new Date(inst.paidDate || inst.updatedAt).toISOString().split("T")[0];

    if (principal > 0 && !(await alreadyCovered("installment_payment", inst.id))) {
      toCreate.push({
        type: "collection",
        sourceType: "installment_payment",
        sourceId: inst.id,
        amount: principal,
        description: `Historical installment #${inst.installmentNo} payment - invoice ${inst.sale?.invoiceNo || inst.saleId}`,
        transactionDate: date,
      });
    }
  }

  const allInstallments = await Installment.findAll({
    include: [{ model: Sale, as: "sale" }],
  });

  for (const inst of allInstallments) {
    const fine = Number(inst.finePaid || 0);
    const date = new Date(inst.paidDate || inst.updatedAt).toISOString().split("T")[0];

    if (fine > 0 && !(await alreadyCovered("fine_payment", inst.id))) {
      toCreate.push({
        type: "collection",
        sourceType: "fine_payment",
        sourceId: inst.id,
        amount: fine,
        description: `Historical installment #${inst.installmentNo} fine payment - invoice ${inst.sale?.invoiceNo || inst.saleId}`,
        transactionDate: date,
      });
    }
  }

  const total = toCreate.reduce((sum, t) => sum + t.amount, 0);

  console.log(`Entries to create: ${toCreate.length}`);
  console.log(`  cash_sale: ${toCreate.filter((t) => t.sourceType === "cash_sale").length}`);
  console.log(`  advance_payment: ${toCreate.filter((t) => t.sourceType === "advance_payment").length}`);
  console.log(`  installment_payment: ${toCreate.filter((t) => t.sourceType === "installment_payment").length}`);
  console.log(`  fine_payment: ${toCreate.filter((t) => t.sourceType === "fine_payment").length}`);
  console.log(`Total amount to collect: Rs. ${total}`);

  if (!commit) {
    console.log("\nDry run only — no changes written. Re-run with --commit to apply.");
    return;
  }

  const t = await sequelize.transaction();

  try {
    for (const entry of toCreate) {
      await ShopTransaction.create(entry, { transaction: t });
    }

    await recalculateShopBalance(t);

    await t.commit();

    console.log(`\nDone. Created ${toCreate.length} collection entries.`);
  } catch (error) {
    await t.rollback();
    console.error("Backfill failed, rolled back:", error.message);
    process.exitCode = 1;
  }
};

run()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
