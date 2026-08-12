const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Sale, SaleItem, Product, ProductBatch, SaleReturn, Customer, User } = require("../models");
const logActivity = require("../utils/activityLogger");

const getToday = () => new Date().toISOString().split("T")[0];

exports.createReturn = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      saleId,
      returnType,
      productId,
      quantity = 1,
      replacementProductId,
      replacementQuantity,
      refundAmount = 0,
      additionalCharge = 0,
      reason,
      notes,
    } = req.body;

    if (!saleId || !returnType || !productId) {
      await t.rollback();
      return res.status(400).json({
        message: "saleId, returnType, and productId are required",
      });
    }

    if (!["return", "exchange"].includes(returnType)) {
      await t.rollback();
      return res.status(400).json({
        message: "returnType must be either 'return' or 'exchange'",
      });
    }

    const sale = await Sale.findByPk(saleId, {
      include: [{ model: SaleItem, as: "items" }],
      transaction: t,
    });
    if (!sale) {
      await t.rollback();
      return res.status(404).json({ message: "Sale not found" });
    }

    const saleItem = (sale.items || []).find(
      (i) => Number(i.productId) === Number(productId)
    );

    if (!saleItem) {
      await t.rollback();
      return res.status(400).json({
        message: "Returned product must belong to the original sale",
      });
    }

    const returnQty = Number(quantity);
    if (returnQty < 1 || returnQty > Number(saleItem.quantity)) {
      await t.rollback();
      return res.status(400).json({
        message: "Quantity must be at least 1 and cannot exceed this item's quantity on the sale",
      });
    }

    const product = await Product.findByPk(productId, { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Returned product not found" });
    }

    let replacementProduct = null;
    let replacementQty = null;

    if (returnType === "exchange") {
      if (!replacementProductId) {
        await t.rollback();
        return res.status(400).json({
          message: "replacementProductId is required for exchange",
        });
      }

      if (Number(replacementProductId) === Number(productId)) {
        await t.rollback();
        return res.status(400).json({
          message: "Replacement product must be different from the returned product",
        });
      }

      replacementProduct = await Product.findByPk(replacementProductId, {
        transaction: t,
      });
      if (!replacementProduct) {
        await t.rollback();
        return res.status(404).json({
          message: "Replacement product not found",
        });
      }

      replacementQty =
        replacementQuantity !== undefined && replacementQuantity !== null
          ? Number(replacementQuantity)
          : returnQty;

      if (replacementQty < 1) {
        await t.rollback();
        return res.status(400).json({
          message: "replacementQuantity must be at least 1",
        });
      }

      if (Number(replacementProduct.quantity) < replacementQty) {
        await t.rollback();
        return res.status(400).json({
          message: "Not enough stock available for the replacement product",
        });
      }
    }

    const saleReturn = await SaleReturn.create(
      {
        saleId,
        productId,
        returnType,
        replacementProductId: replacementProductId || null,
        quantity: returnQty,
        replacementQuantity: replacementQty,
        refundAmount: Number(refundAmount || 0),
        additionalCharge: Number(additionalCharge || 0),
        reason: reason || null,
        notes: notes || null,
        status: "processed",
        processedBy: req.user.id,
        processedAt: getToday(),
        createdBy: req.user.id,
      },
      { transaction: t }
    );

    product.quantity = Number(product.quantity) + returnQty;
    product.status = "in_stock";
    await product.save({ transaction: t });

    if (saleItem.productBatchId) {
      const batch = await ProductBatch.findByPk(saleItem.productBatchId, { transaction: t });
      if (batch) {
        batch.remainingQuantity = Number(batch.remainingQuantity) + returnQty;
        await batch.save({ transaction: t });
      }
    }

    if (replacementProduct) {
      replacementProduct.quantity =
        Number(replacementProduct.quantity) - replacementQty;
      if (replacementProduct.quantity <= 0) {
        replacementProduct.quantity = 0;
        replacementProduct.status = "sold";
      }
      await replacementProduct.save({ transaction: t });
    }

    // Cancel the whole sale only once EVERY item on it has been fully
    // returned/exchanged — generalizes the old single-item sale's
    // "this return covers the whole sale quantity" trigger, since a
    // multi-item sale shouldn't be cancelled just because one of several
    // items was returned while the customer keeps the rest. Includes the
    // return just created above (already committed within this transaction).
    const allReturnsForSale = await SaleReturn.findAll({
      where: { saleId: sale.id },
      attributes: ["productId", "quantity"],
      transaction: t,
      raw: true,
    });

    const returnedTotals = {};
    allReturnsForSale.forEach((r) => {
      returnedTotals[r.productId] = (returnedTotals[r.productId] || 0) + Number(r.quantity);
    });

    const allItemsFullyReturned = sale.items.every(
      (item) => (returnedTotals[item.productId] || 0) >= Number(item.quantity)
    );

    if (allItemsFullyReturned) {
      sale.status = "cancelled";
      await sale.save({ transaction: t });
    }

    await t.commit();

    await logActivity({
      req,
      action: "create",
      module: "sale_returns",
      recordId: saleReturn.id,
      description: `Processed ${returnType} for sale ${sale.invoiceNo}`,
      newData: saleReturn.toJSON(),
    });

    res.status(201).json({
      message: "Sale return/exchange processed successfully",
      saleReturn,
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({
      message: "Sale return failed",
      error: error.message,
    });
  }
};

exports.getReturns = async (req, res) => {
  try {
    const returns = await SaleReturn.findAll({
      include: [
        {
          model: Sale,
          as: "sale",
          include: [
            { model: Customer, as: "customer" },
            {
              model: SaleItem,
              as: "items",
              include: [{ model: Product, as: "product" }],
            },
          ],
        },
        { model: Product, as: "returnedProduct" },
        { model: Product, as: "replacementProduct" },
        {
          model: User,
          as: "createdByUser",
          attributes: ["id", "name", "username", "role"],
        },
        {
          model: User,
          as: "processedByUser",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(returns);
  } catch (error) {
    res.status(500).json({
      message: "Get sale returns failed",
      error: error.message,
    });
  }
};

exports.getReturnById = async (req, res) => {
  try {
    const saleReturn = await SaleReturn.findByPk(req.params.id, {
      include: [
        {
          model: Sale,
          as: "sale",
          include: [
            { model: Customer, as: "customer" },
            {
              model: SaleItem,
              as: "items",
              include: [{ model: Product, as: "product" }],
            },
          ],
        },
        { model: Product, as: "returnedProduct" },
        { model: Product, as: "replacementProduct" },
        {
          model: User,
          as: "createdByUser",
          attributes: ["id", "name", "username", "role"],
        },
        {
          model: User,
          as: "processedByUser",
          attributes: ["id", "name", "username", "role"],
        },
      ],
    });

    if (!saleReturn) {
      return res.status(404).json({ message: "Sale return not found" });
    }

    res.json(saleReturn);
  } catch (error) {
    res.status(500).json({
      message: "Get sale return failed",
      error: error.message,
    });
  }
};
