const User = require("./User");
const Customer = require("./Customer");
const Product = require("./Product");
const Sale = require("./Sale");
const Installment = require("./Installment");
const Partner = require("./Partner");
const PartnerTransaction = require("./PartnerTransaction");

// Sale relations
Sale.belongsTo(Customer, {
  foreignKey: "customerId",
  as: "customer",
});

Sale.belongsTo(Product, {
  foreignKey: "productId",
  as: "product",
});

Sale.belongsTo(User, {
  foreignKey: "soldBy",
  as: "salesman",
});

// Installment relations
Installment.belongsTo(Sale, {
  foreignKey: "saleId",
  as: "sale",
});

Installment.belongsTo(Customer, {
  foreignKey: "customerId",
  as: "customer",
});

Installment.belongsTo(User, {
  foreignKey: "receivedBy",
  as: "receiver",
});

// Partner relations
PartnerTransaction.belongsTo(Partner, {
  foreignKey: "partnerId",
  as: "partner",
});

PartnerTransaction.belongsTo(User, {
  foreignKey: "createdBy",
  as: "createdUser",
});

module.exports = {
  User,
  Customer,
  Product,
  Sale,
  Installment,
  Partner,
  PartnerTransaction,
};