const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const logActivity = require("../utils/activityLogger");
const {
    Investor,
    InvestorTransaction,
    Product,
    ProductBatch,
    Sale,
    User,
} = require("../models");

const recalculateInvestorBalance = async (investorId, transaction = null) => {
    const investor = await Investor.findByPk(investorId, { transaction });

    const transactions = await InvestorTransaction.findAll({
        where: { investorId },
        transaction,
    });

    let totalInvested = 0;
    let totalWithdrawn = 0;
    let totalReturns = 0;
    let lossShare = 0;
    let adjustment = 0;

    transactions.forEach((trx) => {
        const amount = Number(trx.amount);

        if (trx.type === "investment") totalInvested += amount;
        if (trx.type === "withdrawal") totalWithdrawn += amount;
        if (trx.type === "return_credit") totalReturns += amount;
        if (trx.type === "loss_debit") lossShare += amount;
        if (trx.type === "adjustment") adjustment += amount;
    });

    const currentBalance =
        totalInvested + totalReturns + adjustment - totalWithdrawn - lossShare;

    await investor.update(
        {
            totalInvested,
            totalWithdrawn,
            totalReturns,
            lossShare,
            currentBalance,
        },
        { transaction }
    );

    return investor;
};

exports.recalculateInvestorBalance = recalculateInvestorBalance;

const calculateInvestorReturn = async (investor) => {
    if (investor.investorType === "fixed_monthly" || investor.investorType === "fixed_yearly") {
        const period = investor.investorType === "fixed_monthly" ? "monthly" : "yearly";
        const periodDue =
            Number(investor.totalInvested || 0) * (Number(investor.returnPercentage || 0) / 100);

        return { period, periodDue };
    }

    if (investor.investorType === "profit_share") {
        const sales = await Sale.findAll({
            include: [
                {
                    model: ProductBatch,
                    as: "productBatch",
                    where: { investorId: investor.id, fundingSource: "investor" },
                    attributes: ["id", "purchasePrice", "purchaseDate"],
                    include: [
                        {
                            model: Product,
                            as: "product",
                            attributes: ["id", "productName", "purchasePrice", "salePrice", "status"],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const totalProfitRecovered = sales.reduce(
            (sum, sale) => sum + Number(sale.profitRecovered || 0),
            0
        );
        const totalProfitPending = sales.reduce(
            (sum, sale) => sum + Number(sale.profitPending || 0),
            0
        );

        const lifetimeProfitShare = totalProfitRecovered * 0.5;
        const pendingToCredit = lifetimeProfitShare - Number(investor.totalReturns || 0);

        return {
            period: "per_sale",
            totalProfitRecovered,
            totalProfitPending,
            lifetimeProfitShare,
            pendingToCredit,
            fundedSales: sales,
        };
    }

    return null;
};

exports.createInvestor = async (req, res) => {
    try {
        const { investorType, returnPercentage } = req.body;

        if (!["fixed_monthly", "fixed_yearly", "profit_share"].includes(investorType)) {
            return res.status(400).json({ message: "Invalid investor type" });
        }

        if (
            ["fixed_monthly", "fixed_yearly"].includes(investorType) &&
            !(Number(returnPercentage) > 0)
        ) {
            return res.status(400).json({
                message: "Return percentage is required for fixed return investors",
            });
        }

        const investor = await Investor.create({
            ...req.body,
            createdBy: req.user.id,
        });

        res.status(201).json({
            message: "Investor created successfully",
            investor,
        });

        await logActivity({
            req,
            action: "create",
            module: "investors",
            recordId: investor.id,
            description: `Created investor: ${investor.name}`,
            newData: investor.toJSON(),
        });
    } catch (error) {
        res.status(500).json({
            message: "Create investor failed",
            error: error.message,
        });
    }
};

exports.getInvestors = async (req, res) => {
    try {
        const investors = await Investor.findAll({
            order: [["createdAt", "DESC"]],
        });

        res.json(investors);
    } catch (error) {
        res.status(500).json({
            message: "Get investors failed",
            error: error.message,
        });
    }
};

exports.getInvestorById = async (req, res) => {
    try {
        const investor = await Investor.findByPk(req.params.id);

        if (!investor) {
            return res.status(404).json({ message: "Investor not found" });
        }

        const transactions = await InvestorTransaction.findAll({
            where: { investorId: investor.id },
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["transactionDate", "DESC"]],
        });

        const calculated = await calculateInvestorReturn(investor);

        res.json({ investor, transactions, calculated });
    } catch (error) {
        res.status(500).json({
            message: "Get investor failed",
            error: error.message,
        });
    }
};

exports.updateInvestor = async (req, res) => {
    try {
        const investor = await Investor.findByPk(req.params.id);

        if (!investor) {
            return res.status(404).json({ message: "Investor not found" });
        }

        const oldData = investor.toJSON();

        const investorType = req.body.investorType || investor.investorType;
        const returnPercentage =
            req.body.returnPercentage !== undefined
                ? req.body.returnPercentage
                : investor.returnPercentage;

        if (
            ["fixed_monthly", "fixed_yearly"].includes(investorType) &&
            !(Number(returnPercentage) > 0)
        ) {
            return res.status(400).json({
                message: "Return percentage is required for fixed return investors",
            });
        }

        await investor.update(req.body);

        await logActivity({
            req,
            action: "update",
            module: "investors",
            recordId: investor.id,
            description: `Updated investor: ${investor.name}`,
            oldData,
            newData: investor.toJSON(),
        });

        res.json({
            message: "Investor updated successfully",
            investor,
        });
    } catch (error) {
        res.status(500).json({
            message: "Update investor failed",
            error: error.message,
        });
    }
};

exports.deleteInvestor = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const investor = await Investor.findByPk(req.params.id, { transaction: t });

        if (!investor) {
            await t.rollback();
            return res.status(404).json({ message: "Investor not found" });
        }

        const oldData = investor.toJSON();

        await InvestorTransaction.destroy({
            where: { investorId: investor.id },
            transaction: t,
        });

        await investor.destroy({ transaction: t });

        await t.commit();

        await logActivity({
            req,
            action: "delete",
            module: "investors",
            recordId: oldData.id,
            description: `Deleted investor: ${oldData.name}`,
            oldData,
        });

        res.json({ message: "Investor deleted successfully" });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Delete investor failed",
            error: error.message,
        });
    }
};

exports.addInvestorTransaction = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { type, amount, description, transactionDate } = req.body;

        const investor = await Investor.findByPk(req.params.id, { transaction: t });

        if (!investor) {
            await t.rollback();
            return res.status(404).json({ message: "Investor not found" });
        }

        if (!amount || Number(amount) <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Invalid amount" });
        }

        const trx = await InvestorTransaction.create(
            {
                investorId: investor.id,
                type,
                amount,
                description,
                transactionDate: transactionDate || new Date().toISOString().split("T")[0],
                createdBy: req.user.id,
            },
            { transaction: t }
        );

        const updatedInvestor = await recalculateInvestorBalance(investor.id, t);

        await t.commit();

        await logActivity({
            req,
            action: "create",
            module: "investors",
            recordId: trx.id,
            description: `Investor transaction ${type} - Rs. ${amount}`,
            newData: trx.toJSON(),
        });

        res.status(201).json({
            message: "Investor transaction added successfully",
            transaction: trx,
            investor: updatedInvestor,
        });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Add investor transaction failed",
            error: error.message,
        });
    }
};

exports.getInvestorTransactions = async (req, res) => {
    try {
        const transactions = await InvestorTransaction.findAll({
            where: { investorId: req.params.id },
            include: [
                { model: Investor, as: "investor" },
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["transactionDate", "DESC"]],
        });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({
            message: "Get investor transactions failed",
            error: error.message,
        });
    }
};
