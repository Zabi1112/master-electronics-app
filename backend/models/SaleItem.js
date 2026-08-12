const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "SaleItem",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      saleId: { type: DataTypes.INTEGER, allowNull: false },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      productBatchId: { type: DataTypes.INTEGER, allowNull: true },
      quantity: { type: DataTypes.INTEGER, defaultValue: 1 },

      // All price fields below are LINE TOTALS (already × quantity), matching
      // how Sale itself already stores these as totals rather than per-unit.
      purchasePrice: { type: DataTypes.FLOAT, defaultValue: 0 },
      cashPrice: { type: DataTypes.FLOAT, defaultValue: 0 },
      installmentPrice: { type: DataTypes.FLOAT, defaultValue: 0 },
      salePrice: { type: DataTypes.FLOAT, allowNull: false },
      discountShare: { type: DataTypes.FLOAT, defaultValue: 0 },
      finalAmount: { type: DataTypes.FLOAT, allowNull: false },
      profit: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { tableName: "sale_items", timestamps: true }
  );
};
