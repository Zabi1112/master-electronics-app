const {  Customer } = require("../models");
// only destructure what that specific controller needs
const logActivity = require("../utils/activityLogger");

exports.createCustomer = async (req, res) => {
  try {
    const customer = await Customer.create({
      ...req.body,
      createdBy: req.user.id,
    });

    await logActivity({
      req,
      action: "create",
      module: "customers",
      recordId: customer.id,
      description: `Created customer: ${customer.name}`,
      newData: customer.toJSON(),
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

    const oldData = customer.toJSON();
    await customer.update(req.body);

    await logActivity({
      req,
      action: "update",
      module: "customers",
      recordId: customer.id,
      description: `Updated customer: ${customer.name}`,
      oldData,
      newData: customer.toJSON(),
    });

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

    const oldData = customer.toJSON();

    await customer.destroy();

    await logActivity({
      req,
      action: "delete",
      module: "customers",
      recordId: oldData.id,
      description: `Deleted customer: ${oldData.name}`,
      oldData,
    });

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Delete customer failed",
      error: error.message,
    });
  }
};