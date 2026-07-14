const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "ShopAccount",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, defaultValue: "Shop Account" },
      totalCollected: { type: DataTypes.FLOAT, defaultValue: 0 },
      totalUsed: { type: DataTypes.FLOAT, defaultValue: 0 },
      currentBalance: { type: DataTypes.FLOAT, defaultValue: 0 },
    },
    { tableName: "shop_account", timestamps: true }
  );
};
