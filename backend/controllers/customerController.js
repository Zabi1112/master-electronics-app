const Customer = require("../models/Customer");

exports.createCustomer = async (req, res) => {
  try {
    const customer = await Customer.create({
      ...req.body,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    res.status(500).json({
      message: "Create customer failed",
      error: error.message,
    });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: "Get customers failed",
      error: error.message,
    });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({
      message: "Get customer failed",
      error: error.message,
    });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    await customer.update(req.body);

    res.json({
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    res.status(500).json({
      message: "Update customer failed",
      error: error.message,
    });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    await customer.destroy();

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Delete customer failed",
      error: error.message,
    });
  }
};