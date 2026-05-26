const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Customer", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    fatherName: { type: DataTypes.STRING, allowNull: true },
    // ... rest of your fields stay exactly the same ...
  }, { tableName: "customers", timestamps: true });
};

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