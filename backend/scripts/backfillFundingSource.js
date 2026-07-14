/*
 * One-time backfill: tags every pre-existing Product/Expense row that has no
 * fundingSource with Partner "Zabi ullah" and books a matching historical
 * PartnerTransaction (type: investment) so his totalInvested/currentBalance
 * reflect what was actually spent before this feature existed.
 *
 * Usage:
 *   node backend/scripts/backfillFundingSource.js            (dry run, no writes)
 *   node backend/scripts/backfillFundingSource.js --commit   (writes changes)
 */

const dotenv = require("dotenv");
dotenv.config();

const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

const run = async () => {
  const commit = process.argv.includes("--commit");

  await sequelize.authenticate();
  const { Partner, PartnerTransaction, Product, Expense, Sale } = require("../models");

  const { Op } = require("sequelize");

  // Product.quantity is REMAINING stock (decremented on every sale), not the
  // original quantity bought — so the true amount ever invested in a product
  // is its current in-stock value plus whatever has already been sold, whose
  // cost basis lives on Sale.purchasePrice instead of the Product row.
  const productAmount = async (product) => {
    const soldCost = await Sale.sum("purchasePrice", {
      where: { productId: product.id },
    });

    return (
      Number(product.purchasePrice || 0) * Number(product.quantity || 0) +
      Number(soldCost || 0)
    );
  };

  const matches = await Partner.findAll({
    where: { name: { [Op.iLike]: "%warraich%" } },
  });

  if (matches.length !== 1) {
    console.error(
      matches.length === 0
        ? 'No Partner matching "Warraich" was found. Create that Partner record first, then re-run this script.'
        : `Multiple partners matched "Warraich": ${matches.map((p) => `${p.name} (id ${p.id})`).join(", ")}. Narrow the match in this script and re-run.`
    );
    process.exitCode = 1;
    return;
  }

  const zabi = matches[0];

  const products = await Product.findAll({ where: { fundingSource: null } });
  const expenses = await Expense.findAll({ where: { fundingSource: null } });

  const productAmounts = await Promise.all(products.map(productAmount));
  const productTotal = productAmounts.reduce((sum, a) => sum + a, 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  console.log(`Partner: ${zabi.name} (id ${zabi.id})`);
  console.log(`Untagged products: ${products.length} — Rs. ${productTotal}`);
  console.log(`Untagged expenses: ${expenses.length} — Rs. ${expenseTotal}`);
  console.log(`Total to attribute: Rs. ${productTotal + expenseTotal}`);

  if (!commit) {
    console.log("\nDry run only — no changes written. Re-run with --commit to apply.");
    return;
  }

  const t = await sequelize.transaction();

  try {
    const { recalculatePartnerBalance } = require("../controllers/partnerController");

    for (const product of products) {
      const amount = await productAmount(product);

      if (amount > 0) {
        const trx = await PartnerTransaction.create(
          {
            partnerId: zabi.id,
            type: "investment",
            amount,
            description: `Historical inventory purchase: ${product.productName}`,
            transactionDate: product.createdAt.toISOString().split("T")[0],
          },
          { transaction: t }
        );

        product.partnerTransactionId = trx.id;
      }

      product.fundingSource = "partner";
      product.partnerId = zabi.id;
      await product.save({ transaction: t });
    }

    for (const expense of expenses) {
      const amount = Number(expense.amount || 0);

      if (amount > 0) {
        const trx = await PartnerTransaction.create(
          {
            partnerId: zabi.id,
            type: "investment",
            amount,
            description: `Historical expense: ${expense.title}`,
            transactionDate: expense.expenseDate,
          },
          { transaction: t }
        );

        expense.partnerTransactionId = trx.id;
      }

      expense.fundingSource = "partner";
      expense.partnerId = zabi.id;
      await expense.save({ transaction: t });
    }

    await recalculatePartnerBalance(zabi.id, t);

    await t.commit();

    console.log(
      `\nDone. Tagged ${products.length} products and ${expenses.length} expenses to ${zabi.name}.`
    );
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
