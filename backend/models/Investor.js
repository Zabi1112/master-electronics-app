const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "Investor",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      phone: { type: DataTypes.STRING, allowNull: true },
      cnic: { type: DataTypes.STRING, allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      investorType: {
        type: DataTypes.ENUM("fixed_monthly", "fixed_yearly", "profit_share"),
        allowNull: false,
      },
      returnPercentage: { type: DataTypes.FLOAT, allowNull: true },
      totalInvested: { type: DataTypes.FLOAT, defaultValue: 0 },
      totalWithdrawn: { type: DataTypes.FLOAT, defaultValue: 0 },
      totalReturns: { type: DataTypes.FLOAT, defaultValue: 0 },
      lossShare: { type: DataTypes.FLOAT, defaultValue: 0 },
      currentBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        defaultValue: "active",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "investors", timestamps: true }
  );
};
