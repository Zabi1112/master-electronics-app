const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "SaleReturn",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      saleId: { type: DataTypes.INTEGER, allowNull: false },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      returnType: {
        type: DataTypes.ENUM("return", "exchange"),
        allowNull: false,
      },
      replacementProductId: { type: DataTypes.INTEGER, allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      replacementQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      refundAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      additionalCharge: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      reason: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM("pending", "processed", "cancelled"),
        defaultValue: "processed",
      },
      processedBy: { type: DataTypes.INTEGER, allowNull: true },
      processedAt: { type: DataTypes.DATEONLY, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      returnDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    { tableName: "sale_returns", timestamps: true }
  );
};