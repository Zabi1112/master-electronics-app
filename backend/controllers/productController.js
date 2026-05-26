const { Product } = require("../models");
// only destructure what that specific controller needs
const logActivity = require("../utils/activityLogger");

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create({
      ...req.body,
      addedBy: req.user.id,
    });

    await logActivity({
      req,
      action: "create",
      module: "products",
      recordId: product.id,
      description: `Created product: ${product.name}`,
      newData: product.toJSON(),
    });

    res.status(201).json({
      message: "Product added to inventory successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Create product failed",
      error: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
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
    const product = await Product.findByPk(req.params.id);

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
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const oldData = product.toJSON();
    await product.update(req.body);

    await logActivity({
      req,
      action: "update",
      module: "products",
      recordId: product.id,
      description: `Updated product: ${product.name}`,
      oldData,
      newData: product.toJSON(),
    });

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Update product failed",
      error: error.message,
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const oldData = product.toJSON();
    await product.destroy();

    await logActivity({
      req,
      action: "delete",
      module: "products",
      recordId: oldData.id,
      description: `Deleted product: ${oldData.name}`,
      oldData,
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Delete product failed",
      error: error.message,
    });
  }
};