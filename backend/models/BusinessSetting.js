const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "BusinessSetting",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      profitShareMethod: {
        type: DataTypes.ENUM("investment_based", "equal"),
        defaultValue: "investment_based",
      },
      donationPercentage: { type: DataTypes.FLOAT, defaultValue: 2.5 },
      donationReminderEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { tableName: "business_settings", timestamps: true }
  );
};