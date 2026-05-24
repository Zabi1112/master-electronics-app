const { sequelize } = require("../config/db");
const {
  Product,
  Sale,
  Installment,
  Customer,
  User,
} = require("../models");

const generateInvoiceNo = () => {
    return `ME-${Date.now()}`;
};

const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
};

exports.createSale = async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const {
            saleType,
            customerId,
            productId,
            quantity = 1,

            cashPrice = 0,
            installmentPrice = 0,
            salePrice = 0,

            discount = 0,
            advanceAmount = 0,
            paidAmount = 0,

            installmentMonths = 0,
            installmentStartDate,
        } = req.body;

        const product = await Product.findByPk(productId, { transaction: t });

        if (!product) {
            await t.rollback();
            return res.status(404).json({ message: "Product not found" });
        }

        if (product.quantity < quantity || product.status !== "in_stock") {
            await t.rollback();
            return res.status(400).json({ message: "Product not available in stock" });
        }

        if (saleType === "installment" && !customerId) {
            await t.rollback();
            return res.status(400).json({
                message: "Customer is required for installment sale",
            });
        }

        const totalPurchase = Number(product.purchasePrice) * Number(quantity);

        let finalSalePrice = 0;
        let totalPaid = 0;
        let remainingAmount = 0;
        let monthlyInstallment = 0;
        let expectedClearDate = null;
        let profit = 0;
        let profitRecovered = 0;
        let profitPending = 0;

        if (saleType === "cash") {
            finalSalePrice = Number(salePrice || cashPrice) * Number(quantity);
            finalSalePrice = finalSalePrice - Number(discount);

            totalPaid = Number(paidAmount || finalSalePrice);
            remainingAmount = finalSalePrice - totalPaid;

            profit = finalSalePrice - totalPurchase;
            profitRecovered = profit;
            profitPending = 0;
        }

        if (saleType === "installment") {
            if (!installmentMonths || installmentMonths <= 0) {
                await t.rollback();
                return res.status(400).json({
                    message: "Installment months are required",
                });
            }

            finalSalePrice = Number(installmentPrice || salePrice) * Number(quantity);
            finalSalePrice = finalSalePrice - Number(discount);

            totalPaid = Number(advanceAmount);
            remainingAmount = finalSalePrice - totalPaid;

            monthlyInstallment = remainingAmount / Number(installmentMonths);

            const startDate = installmentStartDate || new Date().toISOString().split("T")[0];
            expectedClearDate = addMonths(startDate, Number(installmentMonths) - 1);

            profit = finalSalePrice - totalPurchase;

            // Advance recovery first covers investment, then profit
            const investmentRecovered = Math.min(totalPaid, totalPurchase);
            profitRecovered = Math.max(0, totalPaid - investmentRecovered);
            profitPending = profit - profitRecovered;
        }

        const sale = await Sale.create(
            {
                invoiceNo: generateInvoiceNo(),
                saleType,
                customerId: customerId || null,
                productId,
                quantity,

                purchasePrice: totalPurchase,

                cashPrice: Number(cashPrice) * Number(quantity),
                installmentPrice: Number(installmentPrice) * Number(quantity),

                salePrice: finalSalePrice,
                discount,
                finalAmount: finalSalePrice,

                advanceAmount: saleType === "installment" ? totalPaid : 0,
                paidAmount: totalPaid,
                remainingAmount,

                profit,
                profitRecovered,
                profitPending,

                installmentMonths: saleType === "installment" ? installmentMonths : 0,
                monthlyInstallment,
                installmentStartDate: saleType === "installment" ? installmentStartDate : null,
                expectedClearDate,

                status: saleType === "installment" ? "active" : "completed",
                soldBy: req.user.id,
            },
            { transaction: t }
        );

        product.quantity -= quantity;

        if (product.quantity <= 0) {
            product.quantity = 0;
            product.status = "sold";
        }

        await product.save({ transaction: t });

        if (saleType === "installment") {
            const startDate = installmentStartDate || new Date().toISOString().split("T")[0];
            const dueDay = 10;

            for (let i = 1; i <= installmentMonths; i++) {
                await Installment.create(
                    {
                        saleId: sale.id,
                        customerId,
                        installmentNo: i,
                        dueDate: getInstallmentDueDate(startDate, i - 1, dueDay),
                        amount: monthlyInstallment,
                        remainingAmount: monthlyInstallment,
                        finePercentPerDay: 1.5,
                        fineAmount: 0,
                        fineDiscount: 0,
                        finePaid: 0,
                        lateDays: 0,
                        status: "pending",
                    },
                    { transaction: t }
                );
            }
        }

        await t.commit();

        res.status(201).json({
            message: "Sale created successfully",
            sale,
        });
    } catch (error) {
        await t.rollback();

        res.status(500).json({
            message: "Create sale failed",
            error: error.message,
        });
    }
};

const getInstallmentDueDate = (startDate, monthIndex, dueDay = 10) => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + monthIndex);
    d.setDate(dueDay);
    return d.toISOString().split("T")[0];
};

exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.findAll({
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

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: "Get sales failed", error: error.message });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Product, as: "product" },
        {
          model: User,
          as: "salesman",
          attributes: ["id", "name", "username", "role"],
        },
      ],
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const installments = await Installment.findAll({
      where: { saleId: sale.id },
      include: [
        { model: Customer, as: "customer" },
        {
          model: User,
          as: "receiver",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["installmentNo", "ASC"]],
    });

    res.json({ sale, installments });
  } catch (error) {
    res.status(500).json({ message: "Get sale failed", error: error.message });
  }
};

exports.getInstallments = async (req, res) => {
  try {
    const installments = await Installment.findAll({
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

    res.json(installments);
  } catch (error) {
    res.status(500).json({
      message: "Get installments failed",
      error: error.message,
    });
  }
};