const { Op } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const logActivity = require("../utils/activityLogger");
const { ShopAccount, ShopTransaction, User } = require("../models");

const getOrCreateShopAccount = async (transaction = null) => {
    let account = await ShopAccount.findOne({ transaction });

    if (!account) {
        account = await ShopAccount.create({}, { transaction });
    }

    return account;
};

const recalculateShopBalance = async (transaction = null) => {
    const account = await getOrCreateShopAccount(transaction);

    const transactions = await ShopTransaction.findAll({ transaction });

    let totalCollected = 0;
    let totalUsed = 0;
    let adjustment = 0;

    transactions.forEach((trx) => {
        const amount = Number(trx.amount);

        if (trx.type === "collection") totalCollected += amount;
        if (trx.type === "usage") totalUsed += amount;
        if (trx.type === "adjustment") adjustment += amount;
    });

    const currentBalance = totalCollected + adjustment - totalUsed;

    await account.update(
        { totalCollected, totalUsed, currentBalance },
        { transaction }
    );

    return account;
};

exports.getOrCreateShopAccount = getOrCreateShopAccount;
exports.recalculateShopBalance = recalculateShopBalance;

exports.getShopAccount = async (req, res) => {
    try {
        const account = await getOrCreateShopAccount();

        const transactions = await ShopTransaction.findAll({
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["transactionDate", "DESC"], ["id", "DESC"]],
            limit: 50,
        });

        res.json({ account, transactions });
    } catch (error) {
        res.status(500).json({
            message: "Get shop account failed",
            error: error.message,
        });
    }
};

exports.getShopTransactions = async (req, res) => {
    try {
        const { sourceType, from, to } = req.query;
        const where = {};

        if (sourceType) where.sourceType = sourceType;

        if (from || to) {
            where.transactionDate = {};
            if (from) where.transactionDate[Op.gte] = from;
            if (to) where.transactionDate[Op.lte] = to;
        }

        const transactions = await ShopTransaction.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["transactionDate", "DESC"], ["id", "DESC"]],
        });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({
            message: "Get shop transactions failed",
            error: error.message,
        });
    }
};

exports.addShopAdjustment = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { amount, description, transactionDate } = req.body;

        if (amount === undefined || amount === null || Number(amount) === 0) {
            await t.rollback();
            return res.status(400).json({ message: "A non-zero amount is required" });
        }

        const trx = await ShopTransaction.create(
            {
                type: "adjustment",
                amount: Number(amount),
                description,
                sourceType: "adjustment",
                transactionDate: transactionDate || new Date().toISOString().split("T")[0],
                createdBy: req.user.id,
            },
            { transaction: t }
        );

        const account = await recalculateShopBalance(t);

        await t.commit();

        await logActivity({
            req,
            action: "create",
            module: "shop-account",
            recordId: trx.id,
            description: `Shop account adjustment - Rs. ${amount}`,
            newData: trx.toJSON(),
        });

        res.status(201).json({
            message: "Adjustment added successfully",
            transaction: trx,
            account,
        });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Add adjustment failed",
            error: error.message,
        });
    }
};
