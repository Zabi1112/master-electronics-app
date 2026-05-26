const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define(
    "ActivityLog",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING, allowNull: false },
      module: { type: DataTypes.STRING, allowNull: false },
      recordId: { type: DataTypes.INTEGER, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      oldData: { type: DataTypes.JSONB, allowNull: true },
      newData: { type: DataTypes.JSONB, allowNull: true },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
    },
    { tableName: "activity_logs", timestamps: true }
  );
};