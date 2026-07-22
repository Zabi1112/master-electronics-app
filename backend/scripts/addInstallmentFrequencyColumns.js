/*
 * Targeted, scoped migration: adds the 2 new installment-frequency columns
 * to the existing "sales" table. Written as an explicit queryInterface
 * script (not a full sync({alter:true})) so it only touches exactly these
 * columns and cannot drift/alter anything else in a production schema that
 * already has real data in it.
 *
 * Usage: node backend/scripts/addInstallmentFrequencyColumns.js
 */

const dotenv = require("dotenv");
dotenv.config();

const { DataTypes } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

const newColumns = {
  installmentFrequency: {
    type: DataTypes.ENUM("daily", "weekly", "monthly"),
    defaultValue: "monthly",
  },
  markupPercent: { type: DataTypes.FLOAT, defaultValue: 0 },
};

const run = async () => {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();

  const existing = await qi.describeTable("sales");

  for (const [columnName, definition] of Object.entries(newColumns)) {
    if (existing[columnName]) {
      console.log(`sales.${columnName} already exists, skipping.`);
      continue;
    }

    console.log(`Adding sales.${columnName}...`);
    await qi.addColumn("sales", columnName, definition);
  }

  console.log("\nDone.");
};

run()
  .then(() => process.exit())
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exit(1);
  });
