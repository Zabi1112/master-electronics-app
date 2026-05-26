const { Op, fn, col } = require("sequelize");
const { Expense, User } = require("../models");
const logActivity = require("../utils/activityLogger");

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
    try {
        const { title, category, amount, expenseDate, paymentMethod, notes } =
            req.body;

        if (!title) {
            return res.status(400).json({ message: "Expense title is required" });
        }

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ message: "Valid amount is required" });
        }

        const expense = await Expense.create({
            title,
            category,
            amount: Number(amount),
            expenseDate: expenseDate || new Date().toISOString().split("T")[0],
            paymentMethod,
            notes,
            createdBy: req.user.id,
        });

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
    try {
        const expense = await Expense.findByPk(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        const oldData = expense.toJSON();

        const { title, category, amount, expenseDate, paymentMethod, notes } =
            req.body;

        await expense.update({
            title: title ?? expense.title,
            category: category ?? expense.category,
            amount: amount !== undefined ? Number(amount) : expense.amount,
            expenseDate: expenseDate ?? expense.expenseDate,
            paymentMethod: paymentMethod ?? expense.paymentMethod,
            notes: notes ?? expense.notes,
        });

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
        res.status(500).json({
            message: "Update expense failed",
            error: error.message,
        });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findByPk(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }
        const oldData = expense.toJSON();

        await expense.destroy();

        await logActivity({
            req,
            action: "delete",
            module: "expenses",
            recordId: expense.id,
            description: `Deleted expense: ${expense.title}`,
            oldData: expense.toJSON(),
        });

        res.json({
            message: "Expense deleted successfully",
        });

    } catch (error) {
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