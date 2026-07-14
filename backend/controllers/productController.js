const { getSequelize } = require("../config/db");
const sequelize = getSequelize();
const { Product, ProductBatch, Partner, Investor } = require("../models");
const logActivity = require("../utils/activityLogger");
const { createFundingEntry, removeFundingEntry } = require("../utils/fundingLedger");

const fundingInclude = [
  { model: Partner, as: "fundingPartner", attributes: ["id", "name"] },
  { model: Investor, as: "fundingInvestor", attributes: ["id", "name"] },
];

const batchInclude = {
  model: ProductBatch,
  as: "batches",
  include: [
    { model: Partner, as: "fundingPartner", attributes: ["id", "name"] },
    { model: Investor, as: "fundingInvestor", attributes: ["id", "name"] },
  ],
  order: [["purchaseDate", "ASC"], ["id", "ASC"]],
};

const validateFunding = (fundingSource, partnerId, investorId) => {
  if (fundingSource && !["partner", "shop", "investor"].includes(fundingSource)) {
    return "Invalid funding source";
  }

  if (fundingSource === "partner" && !partnerId) {
    return "Partner is required when funding source is 'partner'";
  }

  if (fundingSource === "investor" && !investorId) {
    return "Investor is required when funding source is 'investor'";
  }

  return null;
};

exports.createProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      fundingSource,
      partnerId,
      investorId,
      purchasePrice = 0,
      quantity = 1,
    } = req.body;

    const fundingError = validateFunding(fundingSource, partnerId, investorId);
    if (fundingError) {
      await t.rollback();
      return res.status(400).json({ message: fundingError });
    }

    const product = await Product.create(
      {
        ...req.body,
        addedBy: req.user.id,
        partnerId: fundingSource === "partner" ? partnerId : null,
        investorId: fundingSource === "investor" ? investorId : null,
      },
      { transaction: t }
    );

    const amount = Number(purchasePrice) * Number(quantity);
    let batchFundingIds = {
      partnerTransactionId: null,
      shopTransactionId: null,
      investorTransactionId: null,
    };

    if (fundingSource && amount > 0) {
      batchFundingIds = await createFundingEntry({
        fundingSource,
        partnerId,
        investorId,
        amount,
        description: `Inventory purchase: ${product.productName}`,
        transactionDate: new Date().toISOString().split("T")[0],
        sourceType: "purchase",
        sourceId: product.id,
        createdBy: req.user.id,
        transaction: t,
      });

      product.partnerTransactionId = batchFundingIds.partnerTransactionId;
      product.shopTransactionId = batchFundingIds.shopTransactionId;
      product.investorTransactionId = batchFundingIds.investorTransactionId;
      await product.save({ transaction: t });
    }

    await ProductBatch.create(
      {
        productId: product.id,
        quantity: Number(quantity),
        remainingQuantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
        purchaseDate: new Date().toISOString().split("T")[0],
        fundingSource: fundingSource || null,
        partnerId: fundingSource === "partner" ? partnerId : null,
        partnerTransactionId: batchFundingIds.partnerTransactionId,
        investorId: fundingSource === "investor" ? investorId : null,
        investorTransactionId: batchFundingIds.investorTransactionId,
        shopTransactionId: batchFundingIds.shopTransactionId,
        createdBy: req.user.id,
      },
      { transaction: t }
    );

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

exports.restockProduct = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const product = await Product.findByPk(req.params.id, { transaction: t });

    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      quantity,
      purchasePrice,
      fundingSource,
      partnerId,
      investorId,
      purchaseDate,
    } = req.body;

    const addedQuantity = Number(quantity);

    if (!addedQuantity || addedQuantity <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    if (purchasePrice === undefined || Number(purchasePrice) < 0) {
      await t.rollback();
      return res.status(400).json({ message: "Valid purchase price is required" });
    }

    const fundingError = validateFunding(fundingSource, partnerId, investorId);
    if (fundingError) {
      await t.rollback();
      return res.status(400).json({ message: fundingError });
    }

    const amount = Number(purchasePrice) * addedQuantity;
    let batchFundingIds = {
      partnerTransactionId: null,
      shopTransactionId: null,
      investorTransactionId: null,
    };

    if (fundingSource && amount > 0) {
      batchFundingIds = await createFundingEntry({
        fundingSource,
        partnerId,
        investorId,
        amount,
        description: `Inventory restock: ${product.productName}`,
        transactionDate: purchaseDate || new Date().toISOString().split("T")[0],
        sourceType: "purchase",
        sourceId: product.id,
        createdBy: req.user.id,
        transaction: t,
      });
    }

    const batch = await ProductBatch.create(
      {
        productId: product.id,
        quantity: addedQuantity,
        remainingQuantity: addedQuantity,
        purchasePrice: Number(purchasePrice),
        purchaseDate: purchaseDate || new Date().toISOString().split("T")[0],
        fundingSource: fundingSource || null,
        partnerId: fundingSource === "partner" ? partnerId : null,
        partnerTransactionId: batchFundingIds.partnerTransactionId,
        investorId: fundingSource === "investor" ? investorId : null,
        investorTransactionId: batchFundingIds.investorTransactionId,
        shopTransactionId: batchFundingIds.shopTransactionId,
        createdBy: req.user.id,
      },
      { transaction: t }
    );

    await product.update(
      {
        quantity: Number(product.quantity) + addedQuantity,
        status: "in_stock",
        purchasePrice: Number(purchasePrice),
        fundingSource: fundingSource || product.fundingSource,
        partnerId: fundingSource === "partner" ? partnerId : product.partnerId,
        investorId: fundingSource === "investor" ? investorId : product.investorId,
      },
      { transaction: t }
    );

    await t.commit();

    await logActivity({
      req,
      action: "update",
      module: "products",
      recordId: product.id,
      description: `Restocked product: ${product.productName} (+${addedQuantity} @ Rs. ${purchasePrice})`,
      newData: batch.toJSON(),
    });

    res.status(201).json({
      message: "Product restocked successfully",
      product,
      batch,
    });
  } catch (error) {
    await t.rollback();

    res.status(500).json({
      message: "Restock product failed",
      error: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      include: [...fundingInclude, batchInclude],
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
      include: [...fundingInclude, batchInclude],
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

    const {
      fundingSource,
      partnerId,
      investorId,
      purchasePrice,
      quantity,
      ...rest
    } = req.body;

    await product.update(rest, { transaction: t });

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

    const batches = await ProductBatch.findAll({
      where: { productId: product.id },
      transaction: t,
    });

    for (const batch of batches) {
      await removeFundingEntry({
        partnerId: batch.partnerId,
        partnerTransactionId: batch.partnerTransactionId,
        shopTransactionId: batch.shopTransactionId,
        investorId: batch.investorId,
        investorTransactionId: batch.investorTransactionId,
        transaction: t,
      });
    }

    await ProductBatch.destroy({ where: { productId: product.id }, transaction: t });

    if (!batches.length && oldData.fundingSource) {
      // Legacy product predating batch tracking — clean up its own funding entry.
      await removeFundingEntry({
        partnerId: oldData.partnerId,
        partnerTransactionId: oldData.partnerTransactionId,
        shopTransactionId: oldData.shopTransactionId,
        investorId: oldData.investorId,
        investorTransactionId: oldData.investorTransactionId,
        transaction: t,
      });
    }

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
