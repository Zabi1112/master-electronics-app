const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Customer", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    fatherName: { type: DataTypes.STRING, allowNull: true },
    // ... rest of your fields stay exactly the same ...
  }, { tableName: "customers", timestamps: true });
};

const Customer = sequelize.define(
    "Customer",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        fatherName: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        cnic: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        phone: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        alternatePhone: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        chequeNumber: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        address: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        jobOrBusiness: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        monthlyIncome: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        reference1Name: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        reference1Phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        reference1Cnic: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        reference2Name: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        reference2Phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        reference2Cnic: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        customerType: {
            type: DataTypes.ENUM("cash", "installment"),
            defaultValue: "cash",
        },

        riskStatus: {
            type: DataTypes.ENUM("good", "normal", "risky", "blacklisted"),
            defaultValue: "normal",
        },

        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },

        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    },
    {
        tableName: "customers",
        timestamps: true,
    }
);

module.exports = Customer;