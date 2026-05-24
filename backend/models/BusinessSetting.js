const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const BusinessSetting = sequelize.define(
  "BusinessSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    profitShareMethod: {
      type: DataTypes.ENUM("investment_based", "equal"),
      defaultValue: "investment_based",
    },

    donationPercentage: {
      type: DataTypes.FLOAT,
      defaultValue: 2.5,
    },

    donationReminderEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "business_settings",
    timestamps: true,
  }
);

module.exports = BusinessSetting;