const { Op, fn, col } = require("sequelize");
const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Expense, User, Partner } = require("../models");
const logActivity = require("../utils/activityLogger");
const { createFundingEntry, removeFundingEntry } = require("../utils/fundingLedger");

const fundingInclude = [
    { model: Partner, as: "fundingPartner", attributes: ["id", "name"] },
];

const buildExpenseWhere = (query) => {
    const { from, to, category, paymentMethod } = query;

    const where = {};

    if (from || to) {
        where.expenseDate = {};
        if (from) where.expenseDate[Op.gte] = from;
        if (to) where.expenseDate[Op.lte] = to;
    }

    if (category) {
        where.category = category;
    }

    if (paymentMethod) {
        where.paymentMethod = paymentMethod;
    }

    return where;
};

const sumExpenses = async (where = {}) => {
    const result = await Expense.findOne({
        attributes: [[fn("SUM", col("amount")), "total"]],
        where,
        raw: true,
    });

    return Number(result.total || 0);
};

exports.createExpense = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const {
            title,
            category,
            amount,
            expenseDate,
            paymentMethod,
            notes,
            fundingSource,
            partnerId,
        } = req.body;

        if (!title) {
            await t.rollback();
            return res.status(400).json({ message: "Expense title is required" });
        }

        if (!amount || Number(amount) <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Valid amount is required" });
        }

        if (fundingSource && !["partner", "shop"].includes(fundingSource)) {
            await t.rollback();
            return res.status(400).json({ message: "Invalid funding source" });
        }

        if (fundingSource === "partner" && !partnerId) {
            await t.rollback();
            return res.status(400).json({
                message: "Partner is required when funding source is 'partner'",
            });
        }

        const expense = await Expense.create(
            {
                title,
                category,
                amount: Number(amount),
                expenseDate: expenseDate || new Date().toISOString().split("T")[0],
                paymentMethod,
                notes,
                createdBy: req.user.id,
                fundingSource: fundingSource || null,
                partnerId: fundingSource === "partner" ? partnerId : null,
            },
            { transaction: t }
        );

        if (fundingSource) {
            const { partnerTransactionId, shopTransactionId } = await createFundingEntry({
                fundingSource,
                partnerId,
                amount: Number(amount),
                description: `Expense: ${expense.title}`,
                transactionDate: expense.expenseDate,
                sourceType: "expense",
                sourceId: expense.id,
                createdBy: req.user.id,
                transaction: t,
            });

            expense.partnerTransactionId = partnerTransactionId;
            expense.shopTransactionId = shopTransactionId;
            await expense.save({ transaction: t });
        }

        await t.commit();

        res.status(201).json({
            message: "Expense created successfully",
            expense,
        });
        await logActivity({
            req,
            action: "create",
            module: "expenses",
            recordId: expense.id,
            description: `Created expense: ${expense.title}`,
            newData: expense.toJSON(),
        });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Create expense failed",
            error: error.message,
        });
    }
};

exports.getExpenses = async (req, res) => {
    try {
        const where = buildExpenseWhere(req.query);

        const expenses = await Expense.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
                ...fundingInclude,
            ],
            order: [["expenseDate", "DESC"]],
        });

        const totalAmount = await sumExpenses(where);

        res.json({
            totalAmount,
            count: expenses.length,
            expenses,
        });
    } catch (error) {
        res.status(500).json({
            message: "Get expenses failed",
            error: error.message,
        });
    }
};

exports.getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
                ...fundingInclude,
            ],
        });

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        res.json(expense);
    } catch (error) {
        res.status(500).json({
            message: "Get expense failed",
            error: error.message,
        });
    }
};

exports.updateExpense = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const expense = await Expense.findByPk(req.params.id, { transaction: t });

        if (!expense) {
            await t.rollback();
            return res.status(404).json({ message: "Expense not found" });
        }

        const oldData = expense.toJSON();

        const {
            title,
            category,
            amount,
            expenseDate,
            paymentMethod,
            notes,
            fundingSource,
            partnerId,
        } = req.body;

        const touchesFunding =
            fundingSource !== undefined ||
            partnerId !== undefined ||
            amount !== undefined;

        const nextFundingSource =
            fundingSource !== undefined ? fundingSource : oldData.fundingSource;

        if (nextFundingSource && !["partner", "shop"].includes(nextFundingSource)) {
            await t.rollback();
            return res.status(400).json({ message: "Invalid funding source" });
        }

        const nextPartnerId =
            partnerId !== undefined ? partnerId : oldData.partnerId;

        if (nextFundingSource === "partner" && !nextPartnerId) {
            await t.rollback();
            return res.status(400).json({
                message: "Partner is required when funding source is 'partner'",
            });
        }

        let linkedIds = {
            partnerTransactionId: oldData.partnerTransactionId,
            shopTransactionId: oldData.shopTransactionId,
        };

        if (touchesFunding && oldData.fundingSource) {
            await removeFundingEntry({
                partnerId: oldData.partnerId,
                partnerTransactionId: oldData.partnerTransactionId,
                shopTransactionId: oldData.shopTransactionId,
                transaction: t,
            });

            linkedIds = { partnerTransactionId: null, shopTransactionId: null };
        }

        const nextAmount = amount !== undefined ? Number(amount) : expense.amount;

        await expense.update(
            {
                title: title ?? expense.title,
                category: category ?? expense.category,
                amount: nextAmount,
                expenseDate: expenseDate ?? expense.expenseDate,
                paymentMethod: paymentMethod ?? expense.paymentMethod,
                notes: notes ?? expense.notes,
                fundingSource: nextFundingSource || null,
                partnerId: nextFundingSource === "partner" ? nextPartnerId : null,
                partnerTransactionId: linkedIds.partnerTransactionId,
                shopTransactionId: linkedIds.shopTransactionId,
            },
            { transaction: t }
        );

        if (touchesFunding && nextFundingSource && nextAmount > 0) {
            const { partnerTransactionId, shopTransactionId } = await createFundingEntry({
                fundingSource: nextFundingSource,
                partnerId: nextPartnerId,
                amount: nextAmount,
                description: `Expense: ${expense.title}`,
                transactionDate: expense.expenseDate,
                sourceType: "expense",
                sourceId: expense.id,
                createdBy: req.user.id,
                transaction: t,
            });

            expense.partnerTransactionId = partnerTransactionId;
            expense.shopTransactionId = shopTransactionId;
            await expense.save({ transaction: t });
        }

        await t.commit();

        await logActivity({
            req,
            action: "update",
            module: "expenses",
            recordId: expense.id,
            description: `Updated expense: ${expense.title}`,
            oldData,
            newData: expense.toJSON(),
        });

        res.json({
            message: "Expense updated successfully",
            expense,
        });

    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Update expense failed",
            error: error.message,
        });
    }
};

exports.deleteExpense = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const expense = await Expense.findByPk(req.params.id, { transaction: t });

        if (!expense) {
            await t.rollback();
            return res.status(404).json({ message: "Expense not found" });
        }
        const oldData = expense.toJSON();

        await removeFundingEntry({
            partnerId: oldData.partnerId,
            partnerTransactionId: oldData.partnerTransactionId,
            shopTransactionId: oldData.shopTransactionId,
            transaction: t,
        });

        await expense.destroy({ transaction: t });

        await t.commit();

        await logActivity({
            req,
            action: "delete",
            module: "expenses",
            recordId: oldData.id,
            description: `Deleted expense: ${oldData.title}`,
            oldData,
        });

        res.json({
            message: "Expense deleted successfully",
        });

    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Delete expense failed",
            error: error.message,
        });
    }
};

exports.getExpenseSummary = async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];

        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(
            now.getMonth() + 1
        ).padStart(2, "0")}-01`;

        const totalExpenses = await sumExpenses();

        const todayExpenses = await sumExpenses({
            expenseDate: today,
        });

        const monthlyExpenses = await sumExpenses({
            expenseDate: {
                [Op.gte]: monthStart,
                [Op.lte]: today,
            },
        });

        const byCategory = await Expense.findAll({
            attributes: ["category", [fn("SUM", col("amount")), "total"]],
            group: ["category"],
            raw: true,
        });

        res.json({
            totalExpenses,
            todayExpenses,
            monthlyExpenses,
            byCategory: byCategory.map((item) => ({
                category: item.category,
                total: Number(item.total || 0),
            })),
        });
    } catch (error) {
        res.status(500).json({
            message: "Expense summary failed",
            error: error.message,
        });
    }
};

exports.getMonthlyExpenseReport = async (req, res) => {
    try {
        const month =
            req.query.month ||
            `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
                2,
                "0"
            )}`;

        const [year, monthNumber] = month.split("-").map(Number);

        const from = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
        const lastDay = new Date(year, monthNumber, 0).getDate();
        const to = `${year}-${String(monthNumber).padStart(2, "0")}-${String(
            lastDay
        ).padStart(2, "0")}`;

        const where = {
            expenseDate: {
                [Op.gte]: from,
                [Op.lte]: to,
            },
        };

        if (req.query.category) {
            where.category = req.query.category;
        }

        if (req.query.paymentMethod) {
            where.paymentMethod = req.query.paymentMethod;
        }

        const expenses = await Expense.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["expenseDate", "DESC"]],
        });

        const totalAmount = await sumExpenses(where);

        const byCategory = await Expense.findAll({
            attributes: ["category", [fn("SUM", col("amount")), "total"]],
            where,
            group: ["category"],
            raw: true,
        });

        const byPaymentMethod = await Expense.findAll({
            attributes: ["paymentMethod", [fn("SUM", col("amount")), "total"]],
            where,
            group: ["paymentMethod"],
            raw: true,
        });

        res.json({
            month,
            from,
            to,
            totalAmount,
            count: expenses.length,
            byCategory: byCategory.map((item) => ({
                category: item.category,
                total: Number(item.total || 0),
            })),
            byPaymentMethod: byPaymentMethod.map((item) => ({
                paymentMethod: item.paymentMethod,
                total: Number(item.total || 0),
            })),
            expenses,
        });
    } catch (error) {
        res.status(500).json({
            message: "Monthly expense report failed",
            error: error.message,
        });
    }
};