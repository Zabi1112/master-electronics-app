const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Product, Partner } = require("../models");
const logActivity = require("../utils/activityLogger");
const { createFundingEntry, removeFundingEntry } = require("../utils/fundingLedger");

const fundingInclude = [
  { model: Partner, as: "fundingPartner", attributes: ["id", "name"] },
];

exports.createProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      fundingSource,
      partnerId,
      purchasePrice = 0,
      quantity = 1,
    } = req.body;

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

    const product = await Product.create(
      {
        ...req.body,
        addedBy: req.user.id,
        partnerId: fundingSource === "partner" ? partnerId : null,
      },
      { transaction: t }
    );

    const amount = Number(purchasePrice) * Number(quantity);

    if (fundingSource && amount > 0) {
      const { partnerTransactionId, shopTransactionId } = await createFundingEntry({
        fundingSource,
        partnerId,
        amount,
        description: `Inventory purchase: ${product.productName}`,
        transactionDate: new Date().toISOString().split("T")[0],
        sourceType: "purchase",
        sourceId: product.id,
        createdBy: req.user.id,
        transaction: t,
      });

      product.partnerTransactionId = partnerTransactionId;
      product.shopTransactionId = shopTransactionId;
      await product.save({ transaction: t });
    }

    await t.commit();

    await logActivity({
      req,
      action: "create",
      module: "products",
      recordId: product.id,
      description: `Created product: ${product.productName}`,
      newData: product.toJSON(),
    });

    res.status(201).json({
      message: "Product added to inventory successfully",
      product,
    });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Create product failed",
      error: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      include: fundingInclude,
      order: [["createdAt", "DESC"]],
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: "Get products failed",
      error: error.message,
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: fundingInclude,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({
      message: "Get product failed",
      error: error.message,
    });
  }
};

exports.updateProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const product = await Product.findByPk(req.params.id, { transaction: t });

    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    const oldData = product.toJSON();

    const { fundingSource, partnerId, purchasePrice, quantity, ...rest } =
      req.body;

    const touchesFunding =
      fundingSource !== undefined ||
      partnerId !== undefined ||
      purchasePrice !== undefined ||
      quantity !== undefined;

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

    const nextPurchasePrice =
      purchasePrice !== undefined ? purchasePrice : oldData.purchasePrice;
    const nextQuantity = quantity !== undefined ? quantity : oldData.quantity;

    await product.update(
      {
        ...rest,
        purchasePrice: nextPurchasePrice,
        quantity: nextQuantity,
        fundingSource: nextFundingSource || null,
        partnerId: nextFundingSource === "partner" ? nextPartnerId : null,
        partnerTransactionId: linkedIds.partnerTransactionId,
        shopTransactionId: linkedIds.shopTransactionId,
      },
      { transaction: t }
    );

    if (touchesFunding && nextFundingSource) {
      const amount = Number(nextPurchasePrice) * Number(nextQuantity);

      if (amount > 0) {
        const { partnerTransactionId, shopTransactionId } = await createFundingEntry({
          fundingSource: nextFundingSource,
          partnerId: nextPartnerId,
          amount,
          description: `Inventory purchase: ${product.productName}`,
          transactionDate: new Date().toISOString().split("T")[0],
          sourceType: "purchase",
          sourceId: product.id,
          createdBy: req.user.id,
          transaction: t,
        });

        product.partnerTransactionId = partnerTransactionId;
        product.shopTransactionId = shopTransactionId;
        await product.save({ transaction: t });
      }
    }

    await t.commit();

    await logActivity({
      req,
      action: "update",
      module: "products",
      recordId: product.id,
      description: `Updated product: ${product.productName}`,
      oldData,
      newData: product.toJSON(),
    });

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Update product failed",
      error: error.message,
    });
  }
};

exports.deleteProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const product = await Product.findByPk(req.params.id, { transaction: t });

    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    const oldData = product.toJSON();

    await removeFundingEntry({
      partnerId: oldData.partnerId,
      partnerTransactionId: oldData.partnerTransactionId,
      shopTransactionId: oldData.shopTransactionId,
      transaction: t,
    });

    await product.destroy({ transaction: t });

    await t.commit();

    await logActivity({
      req,
      action: "delete",
      module: "products",
      recordId: oldData.id,
      description: `Deleted product: ${oldData.productName}`,
      oldData,
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Delete product failed",
      error: error.message,
    });
  }
};
