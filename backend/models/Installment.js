const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Installment = sequelize.define(
    "Installment",
    {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

        saleId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        customerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        installmentNo: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        dueDate: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },

        amount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },

        paidAmount: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        finePercentPerDay: {
            type: DataTypes.FLOAT,
            defaultValue: 1.5,
        },

        fineAmount: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        fineDiscount: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        finePaid: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
        },

        lateDays: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },

        remainingAmount: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },

        paidDate: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },

        status: {
            type: DataTypes.ENUM("pending", "partial", "paid", "overdue"),
            defaultValue: "pending",
        },

        receivedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },

        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "installments",
        timestamps: true,
    }
);

module.exports = Installment;