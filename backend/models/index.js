const User = require("./User");
const Customer = require("./Customer");
const Product = require("./Product");
const Sale = require("./Sale");
const Installment = require("./Installment");
const Partner = require("./Partner");
const PartnerTransaction = require("./PartnerTransaction");
const BusinessSetting = require("./BusinessSetting");
const DonationRecord = require("./DonationRecord");
const Expense = require("./Expense");
const ActivityLog = require("./ActivityLog");

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

DonationRecord.belongsTo(User, {
  foreignKey: "createdBy",
  as: "createdUser",
});

DonationRecord.belongsTo(User, {
  foreignKey: "markedPaidBy",
  as: "paidByUser",
});

Expense.belongsTo(User, {
  foreignKey: "createdBy",
  as: "createdUser",
});

ActivityLog.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

module.exports = {
  User,
  Customer,
  Product,
  Sale,
  Installment,
  Partner,
  PartnerTransaction,
  BusinessSetting,
  DonationRecord,
  Expense,
  ActivityLog,
};