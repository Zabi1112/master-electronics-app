const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "ProductBatch",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      productId: { type: DataTypes.INTEGER, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      remainingQuantity: { type: DataTypes.INTEGER, allowNull: false },
      purchasePrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      purchaseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      fundingSource: {
        type: DataTypes.ENUM("partner", "shop", "investor"),
        allowNull: true,
      },
      partnerId: { type: DataTypes.INTEGER, allowNull: true },
      partnerTransactionId: { type: DataTypes.INTEGER, allowNull: true },
      investorId: { type: DataTypes.INTEGER, allowNull: true },
      investorTransactionId: { type: DataTypes.INTEGER, allowNull: true },
      shopTransactionId: { type: DataTypes.INTEGER, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
    },
    { tableName: "product_batches", timestamps: true }
  );
};
