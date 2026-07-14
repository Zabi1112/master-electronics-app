const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "ShopTransaction",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      type: {
        type: DataTypes.ENUM("collection", "usage", "adjustment"),
        allowNull: false,
      },
      amount: { type: DataTypes.FLOAT, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      sourceType: {
        type: DataTypes.ENUM(
          "advance_payment",
          "installment_payment",
          "fine_payment",
          "cash_sale",
          "purchase",
          "expense",
          "adjustment"
        ),
        allowNull: true,
      },
      sourceId: { type: DataTypes.INTEGER, allowNull: true },
      transactionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "shop_transactions", timestamps: true }
  );
};
