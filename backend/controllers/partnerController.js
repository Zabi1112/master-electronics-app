const { sequelize } = require("../config/db");
const logActivity = require("../utils/activityLogger");
const {
    Partner,
    PartnerTransaction,
    User,
} = require("../models");

const recalculatePartnerBalance = async (partnerId, transaction = null) => {
    const partner = await Partner.findByPk(partnerId, { transaction });

    const transactions = await PartnerTransaction.findAll({
        where: { partnerId },
        transaction,
    });

    let totalInvested = 0;
    let totalWithdrawn = 0;
    let profitShare = 0;
    let lossShare = 0;
    let adjustment = 0;

    transactions.forEach((trx) => {
        const amount = Number(trx.amount);

        if (trx.type === "investment") totalInvested += amount;
        if (trx.type === "withdrawal") totalWithdrawn += amount;
        if (trx.type === "profit_credit") profitShare += amount;
        if (trx.type === "loss_debit") lossShare += amount;
        if (trx.type === "adjustment") adjustment += amount;
    });

    const currentBalance =
        totalInvested + profitShare + adjustment - totalWithdrawn - lossShare;

    await partner.update(
        {
            totalInvested,
            totalWithdrawn,
            profitShare,
            lossShare,
            currentBalance,
        },
        { transaction }
    );

    return partner;
};

exports.createPartner = async (req, res) => {
    try {
        const partner = await Partner.create({
            ...req.body,
            createdBy: req.user.id,
        });

        res.status(201).json({
            message: "Partner created successfully",
            partner,
        });

        await logActivity({
            req,
            action: "create",
            module: "partners",
            recordId: partner.id,
            description: `Created partner: ${partner.name}`,
            newData: partner.toJSON(),
        });
    } catch (error) {
        res.status(500).json({
            message: "Create partner failed",
            error: error.message,
        });
    }
};

exports.getPartners = async (req, res) => {
    try {
        const partners = await Partner.findAll({
            order: [["createdAt", "DESC"]],
        });

        res.json(partners);
    } catch (error) {
        res.status(500).json({
            message: "Get partners failed",
            error: error.message,
        });
    }
};

exports.getPartnerById = async (req, res) => {
    try {
        const partner = await Partner.findByPk(req.params.id);

        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }

        const transactions = await PartnerTransaction.findAll({
            where: { partnerId: partner.id },
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["transactionDate", "DESC"]],
        });

        res.json({ partner, transactions });
    } catch (error) {
        res.status(500).json({
            message: "Get partner failed",
            error: error.message,
        });
    }
};

exports.updatePartner = async (req, res) => {
    try {
        const partner = await Partner.findByPk(req.params.id);
        const oldData = partner.toJSON();

        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }

        await partner.update(req.body);

        await logActivity({
            req,
            action: "update",
            module: "partners",
            recordId: partner.id,
            description: `Updated partner: ${partner.name}`,
            oldData,
            newData: partner.toJSON(),
        });

        res.json({
            message: "Partner updated successfully",
            partner,
        });
    } catch (error) {
        res.status(500).json({
            message: "Update partner failed",
            error: error.message,
        });
    }
};

exports.deletePartner = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const partner = await Partner.findByPk(req.params.id, { transaction: t });
        const oldData = partner.toJSON();
        if (!partner) {
            await t.rollback();
            return res.status(404).json({ message: "Partner not found" });
        }

        await PartnerTransaction.destroy({
            where: { partnerId: partner.id },
            transaction: t,
        });

        await partner.destroy({ transaction: t });

        await t.commit();

        await logActivity({
            req,
            action: "delete",
            module: "partners",
            recordId: oldData.id,
            description: `Deleted partner: ${oldData.name}`,
            oldData,
        });

        res.json({ message: "Partner deleted successfully" });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Delete partner failed",
            error: error.message,
        });
    }
};

exports.addPartnerTransaction = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { type, amount, description, transactionDate } = req.body;

        const partner = await Partner.findByPk(req.params.id, { transaction: t });

        if (!partner) {
            await t.rollback();
            return res.status(404).json({ message: "Partner not found" });
        }

        if (!amount || Number(amount) <= 0) {
            await t.rollback();
            return res.status(400).json({ message: "Invalid amount" });
        }

        const trx = await PartnerTransaction.create(
            {
                partnerId: partner.id,
                type,
                amount,
                description,
                transactionDate: transactionDate || new Date().toISOString().split("T")[0],
                createdBy: req.user.id,
            },
            { transaction: t }
        );

        const updatedPartner = await recalculatePartnerBalance(partner.id, t);

        await t.commit();

        await logActivity({
            req,
            action: "create",
            module: "partners",
            recordId: trx.id,
            description: `Partner transaction ${type} - Rs. ${amount}`,
            newData: trx.toJSON(),
        });

        res.status(201).json({
            message: "Partner transaction added successfully",
            transaction: trx,
            partner: updatedPartner,
        });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Add partner transaction failed",
            error: error.message,
        });
    }
};

exports.getPartnerTransactions = async (req, res) => {
    try {
        const transactions = await PartnerTransaction.findAll({
            where: { partnerId: req.params.id },
            include: [
                { model: Partner, as: "partner" },
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
            message: "Get partner transactions failed",
            error: error.message,
        });
    }
};