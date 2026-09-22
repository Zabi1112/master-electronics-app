const { Op } = require("sequelize");

const nonCancelledSaleWhere = () => ({ status: { [Op.ne]: "cancelled" } });
const nonCancelledSaleInclude = (Sale) => ({
  model: Sale, as: "sale", required: true, where: nonCancelledSaleWhere(),
});

// Preserve the original schedule and actual payments as history. Releasing
// a cancelled balance must never be recorded as a customer payment.
const clearCancelledSaleBalance = async (sale, Installment, transaction) => {
  await sale.update({ remainingAmount: 0, profitPending: 0 }, { transaction });
  await Installment.update(
    { remainingAmount: 0 },
    { where: { saleId: sale.id, remainingAmount: { [Op.ne]: 0 } }, transaction }
  );
};
module.exports = { nonCancelledSaleWhere, nonCancelledSaleInclude, clearCancelledSaleBalance };
