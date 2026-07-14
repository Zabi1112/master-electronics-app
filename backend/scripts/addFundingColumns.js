/*
 * Targeted, scoped migration: adds only the 4 new funding-source columns to
 * the existing "products" and "expenses" tables. Written as an explicit
 * queryInterface.addColumn script (not a full sync({alter:true})) so it only
 * touches exactly these columns and cannot drift/alter anything else in a
 * production schema that already has real data in it.
 *
 * Usage: node backend/scripts/addFundingColumns.js
 */

const dotenv = require("dotenv");
dotenv.config();

const { DataTypes } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

const newColumns = {
  fundingSource: { type: DataTypes.ENUM("partner", "shop"), allowNull: true },
  partnerId: { type: DataTypes.INTEGER, allowNull: true },
  partnerTransactionId: { type: DataTypes.INTEGER, allowNull: true },
  shopTransactionId: { type: DataTypes.INTEGER, allowNull: true },
};

const run = async () => {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();

  for (const tableName of ["products", "expenses"]) {
    const existing = await qi.describeTable(tableName);

    for (const [columnName, definition] of Object.entries(newColumns)) {
      if (existing[columnName]) {
        console.log(`${tableName}.${columnName} already exists, skipping.`);
        continue;
      }

      console.log(`Adding ${tableName}.${columnName}...`);
      await qi.addColumn(tableName, columnName, definition);
    }
  }

  console.log("\nDone.");
};

run()
  .then(() => process.exit())
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exit(1);
  });
