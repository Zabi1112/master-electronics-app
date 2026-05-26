const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Customer", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    fatherName: { type: DataTypes.STRING, allowNull: true },
    // ... rest of your fields stay exactly the same ...
  }, { tableName: "customers", timestamps: true });
};

const Sale = sequelize.define(
  "Sale",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    invoiceNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    saleType: {
      type: DataTypes.ENUM("cash", "installment"),
      allowNull: false,
    },

    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },

    purchasePrice: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    cashPrice: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    installmentPrice: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    salePrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    discount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    finalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    advanceAmount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    paidAmount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    remainingAmount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    profit: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    profitRecovered: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    profitPending: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    installmentMonths: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    monthlyInstallment: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    installmentStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    expectedClearDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("completed", "active", "cleared", "cancelled"),
      defaultValue: "completed",
    },

    soldBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "sales",
    timestamps: true,
  }
);

module.exports = Sale;