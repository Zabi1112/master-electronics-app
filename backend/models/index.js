const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

// Initialize all models
const User = require("./User")(sequelize);
const Customer = require("./Customer")(sequelize);
const Product = require("./Product")(sequelize);
const Sale = require("./Sale")(sequelize);
const Installment = require("./Installment")(sequelize);
const Partner = require("./Partner")(sequelize);
const PartnerTransaction = require("./PartnerTransaction")(sequelize);
const BusinessSetting = require("./BusinessSetting")(sequelize);
const DonationRecord = require("./DonationRecord")(sequelize);
const Expense = require("./Expense")(sequelize);
const ActivityLog = require("./ActivityLog")(sequelize);

// Sale relations
Sale.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Sale.belongsTo(Product, { foreignKey: "productId", as: "product" });
Sale.belongsTo(User, { foreignKey: "soldBy", as: "salesman" });

// Installment relations
Installment.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });
Installment.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });
Installment.belongsTo(User, { foreignKey: "receivedBy", as: "receiver" });

// Partner relations
PartnerTransaction.belongsTo(Partner, { foreignKey: "partnerId", as: "partner" });
PartnerTransaction.belongsTo(User, { foreignKey: "createdBy", as: "createdUser" });

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
  Installment,
  Partner,
  PartnerTransaction,
  BusinessSetting,
  DonationRecord,
  Expense,
  ActivityLog,
};