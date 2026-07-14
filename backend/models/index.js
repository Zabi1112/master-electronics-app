const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

// Initialize all models
const User = require("./User")(sequelize);
const Customer = require("./Customer")(sequelize);
const Product = require("./Product")(sequelize);
const Sale = require("./Sale")(sequelize);
const SaleReturn = require("./SaleReturn")(sequelize);
const Installment = require("./Installment")(sequelize);
const Partner = require("./Partner")(sequelize);
const PartnerTransaction = require("./PartnerTransaction")(sequelize);
const Investor = require("./Investor")(sequelize);
const InvestorTransaction = require("./InvestorTransaction")(sequelize);
const ShopAccount = require("./ShopAccount")(sequelize);
const ShopTransaction = require("./ShopTransaction")(sequelize);
const BusinessSetting = require("./BusinessSetting")(sequelize);
const DonationRecord = require("./DonationRecord")(sequelize);
const Expense = require("./Expense")(sequelize);
const ActivityLog = require("./ActivityLog")(sequelize);

// Sale relations
Sale.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Sale.belongsTo(Product, { foreignKey: "productId", as: "product" });
Sale.belongsTo(User, { foreignKey: "soldBy", as: "salesman" });

// Sale return relations
SaleReturn.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });
SaleReturn.belongsTo(Product, {
  foreignKey: "productId",
  as: "returnedProduct",
});
SaleReturn.belongsTo(Product, {
  foreignKey: "replacementProductId",
  as: "replacementProduct",
});
SaleReturn.belongsTo(User, {
  foreignKey: "createdBy",
  as: "createdByUser",
});
SaleReturn.belongsTo(User, {
  foreignKey: "processedBy",
  as: "processedByUser",
});

// Installment relations
Installment.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });
Installment.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Installment.belongsTo(User, { foreignKey: "receivedBy", as: "receiver" });

// Partner relations
PartnerTransaction.belongsTo(Partner, { foreignKey: "partnerId", as: "partner" });
PartnerTransaction.belongsTo(User, { foreignKey: "createdBy", as: "createdUser" });

// Investor relations
InvestorTransaction.belongsTo(Investor, { foreignKey: "investorId", as: "investor" });
InvestorTransaction.belongsTo(User, { foreignKey: "createdBy", as: "createdUser" });

// Shop account relations
ShopTransaction.belongsTo(User, { foreignKey: "createdBy", as: "createdUser" });

// Product/Expense funding source relations
Product.belongsTo(Partner, { foreignKey: "partnerId", as: "fundingPartner" });
Product.belongsTo(PartnerTransaction, {
  foreignKey: "partnerTransactionId",
  as: "partnerTransaction",
});
Product.belongsTo(ShopTransaction, {
  foreignKey: "shopTransactionId",
  as: "shopTransaction",
});
Product.belongsTo(Investor, { foreignKey: "investorId", as: "fundingInvestor" });
Product.belongsTo(InvestorTransaction, {
  foreignKey: "investorTransactionId",
  as: "investorTransaction",
});

Expense.belongsTo(Partner, { foreignKey: "partnerId", as: "fundingPartner" });
Expense.belongsTo(PartnerTransaction, {
  foreignKey: "partnerTransactionId",
  as: "partnerTransaction",
});
Expense.belongsTo(ShopTransaction, {
  foreignKey: "shopTransactionId",
  as: "shopTransaction",
});
Expense.belongsTo(Investor, { foreignKey: "investorId", as: "fundingInvestor" });
Expense.belongsTo(InvestorTransaction, {
  foreignKey: "investorTransactionId",
  as: "investorTransaction",
});

// Donation relations
DonationRecord.belongsTo(User, { foreignKey: "createdBy", as: "createdUser" });
DonationRecord.belongsTo(User, { foreignKey: "markedPaidBy", as: "paidByUser" });

// Expense relations
Expense.belongsTo(User, { foreignKey: "createdBy", as: "createdUser" });

// ActivityLog relations
ActivityLog.belongsTo(User, { foreignKey: "userId", as: "user" });

module.exports = {
  sequelize,
  User,
  Customer,
  Product,
  Sale,
  SaleReturn,
  Installment,
  Partner,
  PartnerTransaction,
  Investor,
  InvestorTransaction,
  ShopAccount,
  ShopTransaction,
  BusinessSetting,
  DonationRecord,
  Expense,
  ActivityLog,
};