const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "DonationRecord",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      month: { type: DataTypes.STRING, allowNull: false },
      profitAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
      donationPercentage: { type: DataTypes.FLOAT, defaultValue: 0 },
      donationAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("due", "paid"),
        defaultValue: "due",
      },
      paidDate: { type: DataTypes.DATEONLY, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      markedPaidBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "donation_records", timestamps: true }
  );
};