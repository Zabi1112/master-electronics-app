const Product = require("../models/Product");

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create({
      ...req.body,
      addedBy: req.user.id,
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

    await product.update(req.body);

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

    await product.destroy();

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Delete product failed",
      error: error.message,
    });
  }
};