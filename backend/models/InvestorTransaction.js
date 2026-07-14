const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "InvestorTransaction",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      investorId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(
          "investment",
          "withdrawal",
          "return_credit",
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
    { tableName: "investor_transactions", timestamps: true }
  );
};
