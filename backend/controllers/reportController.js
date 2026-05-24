const { Op, fn, col } = require("sequelize");
const {
    Sale,
    Product,
    Installment,
    Partner,
    PartnerTransaction,
    Customer,
    User,
} = require("../models");

const getDateFilter = (from, to) => {
    if (!from && !to) return {};

    const filter = {};

    if (from) filter[Op.gte] = new Date(`${from}T00:00:00`);
    if (to) filter[Op.lte] = new Date(`${to}T23:59:59`);

    return { createdAt: filter };
};

const sumField = async (Model, field, where = {}) => {
    const result = await Model.findOne({
        attributes: [[fn("SUM", col(field)), "total"]],
        where,
        raw: true,
    });

    return Number(result.total || 0);
};

const todayDate = () => new Date().toISOString().split("T")[0];

const calculateFine = (installment) => {
    const dueDate = new Date(installment.dueDate);
    const today = new Date();

    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (today <= dueDate) {
        return { lateDays: 0, fineAmount: 0 };
    }

    const lateDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    const fineAmount =
        Number(installment.remainingAmount) *
        (Number(installment.finePercentPerDay || 1.5) / 100) *
        lateDays;

    return {
        lateDays,
        fineAmount: Math.round(fineAmount),
    };
};

exports.salesReport = async (req, res) => {
    try {
        const { from, to, saleType } = req.query;

        const where = {
            ...getDateFilter(from, to),
        };

        if (saleType) where.saleType = saleType;

        const sales = await Sale.findAll({
            where,
            include: [
                { model: Customer, as: "customer" },
                { model: Product, as: "product" },
                {
                    model: User,
                    as: "salesman",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        const summary = {
            totalSales: await sumField(Sale, "finalAmount", where),
            totalPaid: await sumField(Sale, "paidAmount", where),
            totalRemaining: await sumField(Sale, "remainingAmount", where),
            totalProfit: await sumField(Sale, "profit", where),
            profitRecovered: await sumField(Sale, "profitRecovered", where),
            profitPending: await sumField(Sale, "profitPending", where),
        };

        res.json({ summary, sales });
    } catch (error) {
        res.status(500).json({
            message: "Sales report failed",
            error: error.message,
        });
    }
};

exports.installmentReport = async (req, res) => {
    try {
        const { from, to, status } = req.query;

        const where = {};

        if (from || to) {
            where.dueDate = {};
            if (from) where.dueDate[Op.gte] = from;
            if (to) where.dueDate[Op.lte] = to;
        }

        if (status) where.status = status;

        const installments = await Installment.findAll({
            where,
            include: [
                { model: Customer, as: "customer" },
                { model: Sale, as: "sale" },
                {
                    model: User,
                    as: "receiver",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["dueDate", "ASC"]],
        });

        const data = installments.map((item) => {
            const json = item.toJSON();
            const fine = calculateFine(json);

            return {
                ...json,
                liveLateDays: fine.lateDays,
                liveFineAmount: fine.fineAmount,
                liveTotalPayable: Number(json.remainingAmount) + fine.fineAmount,
            };
        });

        const summary = {
            totalInstallmentAmount: await sumField(Installment, "amount", where),
            totalPaid: await sumField(Installment, "paidAmount", where),
            totalRemaining: await sumField(Installment, "remainingAmount", where),
            totalFinePaid: await sumField(Installment, "finePaid", where),
            totalFineDiscount: await sumField(Installment, "fineDiscount", where),
        };

        res.json({ summary, installments: data });
    } catch (error) {
        res.status(500).json({
            message: "Installment report failed",
            error: error.message,
        });
    }
};

exports.overdueReport = async (req, res) => {
  try {
    const today = todayDate();

    const where = {
      dueDate: { [Op.lt]: today },
      status: { [Op.in]: ["pending", "partial"] },
    };

    const installments = await Installment.findAll({
      where,
      include: [
        { model: Customer, as: "customer" },
        { model: Sale, as: "sale" },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["dueDate", "ASC"]],
    });

    const data = installments.map((item) => {
      const json = item.toJSON();
      const fine = calculateFine(json);

      return {
        ...json,
        liveLateDays: fine.lateDays,
        liveFineAmount: fine.fineAmount,
        liveTotalPayable: Number(json.remainingAmount) + fine.fineAmount,
      };
    });

    const summary = {
      overdueCount: data.length,
      overdueAmount: data.reduce(
        (sum, item) => sum + Number(item.remainingAmount || 0),
        0
      ),
      liveFineAmount: data.reduce(
        (sum, item) => sum + Number(item.liveFineAmount || 0),
        0
      ),
      liveTotalPayable: data.reduce(
        (sum, item) => sum + Number(item.liveTotalPayable || 0),
        0
      ),
    };

    res.json({ summary, overdueInstallments: data });
  } catch (error) {
    res.status(500).json({
      message: "Overdue report failed",
      error: error.message,
    });
  }
};


exports.inventoryReport = async (req, res) => {
    try {
        const products = await Product.findAll({
            order: [["createdAt", "DESC"]],
        });

        const lowStockItems = products.filter(
            (p) =>
                Number(p.quantity) > 0 &&
                Number(p.quantity) <= Number(p.lowStockAlertQty || 1)
        );

        const outOfStockItems = products.filter(
            (p) => Number(p.quantity) <= 0 || p.status === "sold"
        );

        const inventoryValue = products.reduce((sum, p) => {
            if (p.status === "in_stock") {
                return sum + Number(p.purchasePrice || 0) * Number(p.quantity || 0);
            }
            return sum;
        }, 0);

        const expectedSaleValue = products.reduce((sum, p) => {
            if (p.status === "in_stock") {
                return sum + Number(p.salePrice || 0) * Number(p.quantity || 0);
            }
            return sum;
        }, 0);

        res.json({
            summary: {
                totalProducts: products.length,
                inventoryValue,
                expectedSaleValue,
                lowStockCount: lowStockItems.length,
                outOfStockCount: outOfStockItems.length,
            },
            products,
            lowStockItems,
            outOfStockItems,
        });
    } catch (error) {
        res.status(500).json({
            message: "Inventory report failed",
            error: error.message,
        });
    }
};

exports.partnerReport = async (req, res) => {
    try {
        const partners = await Partner.findAll({
            order: [["createdAt", "DESC"]],
        });

        const summary = {
            totalInvested: await sumField(Partner, "totalInvested"),
            totalWithdrawn: await sumField(Partner, "totalWithdrawn"),
            totalProfitShare: await sumField(Partner, "profitShare"),
            totalLossShare: await sumField(Partner, "lossShare"),
            totalCurrentBalance: await sumField(Partner, "currentBalance"),
        };

        res.json({ summary, partners });
    } catch (error) {
        res.status(500).json({
            message: "Partner report failed",
            error: error.message,
        });
    }
};

exports.partnerLedgerReport = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const { from, to } = req.query;

        const partner = await Partner.findByPk(partnerId);

        if (!partner) {
            return res.status(404).json({ message: "Partner not found" });
        }

        const where = {
            partnerId,
            ...getDateFilter(from, to),
        };

        const transactions = await PartnerTransaction.findAll({
            where,
            include: [
                {
                    model: User,
                    as: "createdUser",
                    attributes: ["id", "name", "username", "role"],
                },
            ],
            order: [["transactionDate", "DESC"]],
        });

        res.json({
            partner,
            transactions,
        });
    } catch (error) {
        res.status(500).json({
            message: "Partner ledger report failed",
            error: error.message,
        });
    }
};

exports.profitReport = async (req, res) => {
    try {
        const { from, to } = req.query;

        const where = {
            ...getDateFilter(from, to),
        };

        const summary = {
            totalSales: await sumField(Sale, "finalAmount", where),
            totalPurchaseCost: await sumField(Sale, "purchasePrice", where),
            totalProfit: await sumField(Sale, "profit", where),
            profitRecovered: await sumField(Sale, "profitRecovered", where),
            profitPending: await sumField(Sale, "profitPending", where),
            totalRegained: await sumField(Sale, "paidAmount", where),
            totalReceivable: await sumField(Sale, "remainingAmount", where),
        };

        const sales = await Sale.findAll({
            where,
            order: [["createdAt", "DESC"]],
        });

        res.json({ summary, sales });
    } catch (error) {
        res.status(500).json({
            message: "Profit report failed",
            error: error.message,
        });
    }
};

exports.customerReport = async (req, res) => {
    try {
        const customers = await Customer.findAll({
            order: [["createdAt", "DESC"]],
        });

        res.json({
            summary: {
                totalCustomers: customers.length,
                installmentCustomers: customers.filter(
                    (c) => c.customerType === "installment"
                ).length,
                cashCustomers: customers.filter((c) => c.customerType === "cash")
                    .length,
                riskyCustomers: customers.filter((c) => c.riskStatus === "risky")
                    .length,
                blacklistedCustomers: customers.filter(
                    (c) => c.riskStatus === "blacklisted"
                ).length,
            },
            customers,
        });
    } catch (error) {
        res.status(500).json({
            message: "Customer report failed",
            error: error.message,
        });
    }
};