/* Run from any directory. Dry-run by default; --apply writes audited corrections. */
require("dotenv").config({ path: require("path").join(__dirname, "../.env"), quiet: true });
const { Op } = require("sequelize");
const { sequelize, Sale, Installment, ActivityLog } = require("../models");
const { clearCancelledSaleBalance } = require("../utils/saleStatus");

async function run() {
  const apply = process.argv.includes("--apply");
  const corrections = [];
  await sequelize.transaction(async transaction => {
    if (!apply) await sequelize.query("SET TRANSACTION READ ONLY", { transaction });
    if (apply) {
      await sequelize.query("SET LOCAL lock_timeout = '10s'", { transaction });
      await sequelize.query("LOCK TABLE installments, sales IN SHARE ROW EXCLUSIVE MODE", { transaction });
    }
    const sales = await Sale.findAll({ where: { status: "cancelled" }, transaction });
    for (const sale of sales) {
      const installments = await Installment.findAll({ where: { saleId: sale.id }, transaction });
      const outstanding = installments.filter(item => Number(item.remainingAmount) !== 0);
      if (!Number(sale.remainingAmount) && !Number(sale.profitPending) && !outstanding.length) continue;
      const oldData = { sale: sale.toJSON(), installments: installments.map(item => item.toJSON()) };
      corrections.push({ saleId: sale.id, remainingAmount: sale.remainingAmount,
        installmentCount: outstanding.length,
        installmentBalance: outstanding.reduce((sum, item) => sum + Number(item.remainingAmount), 0) });
      if (apply) {
        await clearCancelledSaleBalance(sale, Installment, transaction);
        await ActivityLog.create({ userId: null, action: "update", module: "sales", recordId: sale.id,
          description: "User-requested repair: release outstanding balances on a cancelled sale. Preserve actual payments and original schedule.",
          oldData, newData: { status: "cancelled", remainingAmount: 0, profitPending: 0, installmentRemainingAmount: 0 }
        }, { transaction });
      }
    }
    if (apply) {
      const invalidSales = await Sale.count({ where: { status: "cancelled", [Op.or]: [
        { remainingAmount: { [Op.ne]: 0 } }, { profitPending: { [Op.ne]: 0 } }
      ] }, transaction });
      const invalidInstallments = await Installment.count({
        where: { remainingAmount: { [Op.ne]: 0 } },
        include: [{ model: Sale, as: "sale", required: true, where: { status: "cancelled" } }], transaction
      });
      if (invalidSales || invalidInstallments) throw new Error("Cancelled balance verification failed; rolling back");
    }
  });
  console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", corrections }, null, 2));
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => sequelize.close());
