const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "Product",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      productName: { type: DataTypes.STRING, allowNull: false },
      category: { type: DataTypes.STRING, allowNull: false },
      brand: { type: DataTypes.STRING, allowNull: true },
      model: { type: DataTypes.STRING, allowNull: true },
      serialNumber: { type: DataTypes.STRING, allowNull: true, unique: true },
      imeiNumber: { type: DataTypes.STRING, allowNull: true },
      purchasePrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      salePrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      warrantyInfo: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("in_stock", "sold", "returned", "damaged"),
        defaultValue: "in_stock",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      addedBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "products", timestamps: true }
  );
};