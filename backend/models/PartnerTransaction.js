const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "PartnerTransaction",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      partnerId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(
          "investment",
          "withdrawal",
          "profit_credit",
          "loss_debit",
          "adjustment"
        ),
        allowNull: false,
      },
      amount: { type: DataTypes.FLOAT, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      transactionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "partner_transactions", timestamps: true }
  );
};