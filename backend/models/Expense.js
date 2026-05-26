const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "Expense",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING, allowNull: false },
      category: {
        type: DataTypes.ENUM(
          "rent",
          "salary",
          "guest",
          "utility",
          "transport",
          "maintenance",
          "marketing",
          "donation",
          "misc"
        ),
        defaultValue: "misc",
      },
      amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      expenseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      paymentMethod: {
        type: DataTypes.ENUM("cash", "bank", "easypaisa", "jazzcash", "other"),
        defaultValue: "cash",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "expenses", timestamps: true }
  );
};