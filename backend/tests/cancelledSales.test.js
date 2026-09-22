const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const { clearCancelledSaleBalance } = require("../utils/saleStatus");

const sales = [
  { id: 1, status: "active", installmentMonths: 3, finalAmount: 100, paidAmount: 20, remainingAmount: 80 },
  { id: 2, status: "cancelled", installmentMonths: 3, finalAmount: 900, paidAmount: 100, remainingAmount: 800 },
  { id: 3, status: "cleared", installmentMonths: 6, finalAmount: 200, paidAmount: 200, remainingAmount: 0 },
];
const installments = sales.map(sale => ({ id: sale.id, saleId: sale.id, sale, installmentNo: 2,
  dueDate: "2026-09-10", status: sale.remainingAmount ? "pending" : "paid",
  amount: sale.finalAmount, paidAmount: sale.paidAmount, remainingAmount: sale.remainingAmount,
  finePaid: 0, fineDiscount: 0 }));
function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (!expected || typeof expected !== "object") return row[key] === expected;
    return Reflect.ownKeys(expected).every(op => {
      if (op === Op.ne) return row[key] !== expected[op];
      if (op === Op.in) return expected[op].includes(row[key]);
      if (op === Op.lt) return row[key] < expected[op];
      if (op === Op.gte) return row[key] >= expected[op];
      if (op === Op.lte) return row[key] <= expected[op];
      throw Error("Unhandled filter");
    });
  });
}
const jsonRow = row => ({ ...row, toJSON: () => ({ ...row }) });
const models = {
  Sale: {
    findAll: async ({ where }) => sales.filter(row => matches(row, where)).map(jsonRow),
    findOne: async ({ where, attributes }) => ({ total: sales.filter(row => matches(row, where))
      .reduce((sum, row) => sum + Number(row[attributes[0][0].args[0].col] || 0), 0) }),
  },
  Installment: { findAll: async ({ where, include }) => {
    const join = include.find(item => item.as === "sale");
    return installments.filter(row => matches(row, where) && (!join?.required || matches(row.sale, join.where))).map(jsonRow);
  } },
  SaleItem: {}, SaleReturn: {}, ActivityLog: { create: async () => ({}) }, ShopAccount: {}, ShopTransaction: {},
  Product: {}, ProductBatch: {}, Customer: {}, User: {}, Partner: {}, PartnerTransaction: {},
};
const database = {};
require.cache[require.resolve("../models")] = { exports: models };
require.cache[require.resolve("../config/db")] = { exports: { getSequelize: () => database } };
const reports = require("../controllers/reportController");
const controller = require("../controllers/installmentController");
const returns = require("../controllers/returnController");
async function call(handler, query = {}) {
  let body; const res = { json(value) { body = value; }, status(code) { throw Error("HTTP " + code); } };
  await handler({ query, params: {} }, res); return body;
}

test("monthly due list excludes cancelled sales, preserves cleared payments and plan filter", async () => {
  const all = await call(controller.getDueThisMonth, { month: "2026-09" });
  assert.deepEqual(all.installments.map(row => row.saleId), [1, 3]);
  assert.equal(all.summary.totalRemaining, 80);
  assert.equal(all.summary.totalCollected, 220);
  const plan = await call(controller.getDueThisMonth, { month: "2026-09", planMonths: "3" });
  assert.deepEqual(plan.installments.map(row => row.saleId), [1]);
  const empty = await call(controller.getDueThisMonth, { month: "2026-09", planMonths: "12" });
  assert.equal(empty.summary.totalItems, 0);
  assert.equal(empty.summary.totalRemaining, 0);
});
test("pending and overdue lists ignore legacy cancelled installments still marked pending", async () => {
  for (const handler of [controller.getPendingInstallments, controller.getOverdueInstallments]) {
    const rows = await call(handler);
    assert.deepEqual(rows.map(row => row.saleId), [1]);
  }
  const overdue = await call(reports.overdueReport);
  assert.equal(overdue.summary.overdueAmount, 80);
});
test("sales and profit report rows and totals use the same non-cancelled sales", async () => {
  for (const handler of [reports.salesReport, reports.profitReport]) {
    const result = await call(handler);
    assert.deepEqual(result.sales.map(row => row.id), [1, 3]);
    assert.equal(result.summary.totalSales, 300);
  }
});
test("installment report summary excludes cancelled principal and collected amounts", async () => {
  const result = await call(reports.installmentReport);
  assert.deepEqual(result.installments.map(row => row.saleId), [1, 3]);
  assert.equal(result.summary.totalInstallmentAmount, 300);
  assert.equal(result.summary.totalPaid, 220);
  assert.equal(result.summary.totalRemaining, 80);
});
test("cancellation releases balance without inventing payments or erasing schedule", async () => {
  const sale = { id: 2, remainingAmount: 800, profitPending: 50, paidAmount: 100,
    update: async function(values) { Object.assign(this, values); } };
  const schedule = [{ saleId: 2, amount: 900, paidAmount: 100, remainingAmount: 800, status: "partial" },
    { saleId: 1, amount: 100, paidAmount: 20, remainingAmount: 80, status: "partial" }];
  const Installment = { update: async (values, { where }) => schedule.filter(row => matches(row, where))
    .forEach(row => Object.assign(row, values)) };
  await clearCancelledSaleBalance(sale, Installment, {});
  await clearCancelledSaleBalance(sale, Installment, {});
  assert.equal(sale.remainingAmount, 0); assert.equal(sale.profitPending, 0); assert.equal(sale.paidAmount, 100);
  assert.deepEqual(schedule[0], { saleId: 2, amount: 900, paidAmount: 100, remainingAmount: 0, status: "partial" });
  assert.equal(schedule[1].remainingAmount, 80);
});


test("full return clears outstanding amounts; a partial return keeps the sale payable", async () => {
  for (const fullyReturned of [false, true]) {
    let committed = false;
    const transaction = { LOCK: { UPDATE: "UPDATE" }, commit: async () => { committed = true; }, rollback: async () => {} };
    database.transaction = async () => transaction;
    const sale = { id: 9, invoiceNo: "TEST", status: "active", remainingAmount: 80, profitPending: 10,
      items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }],
      update: async function(values) { Object.assign(this, values); } };
    models.Sale.findByPk = async () => sale;
    const previousFindAll = models.Installment.findAll;
    models.Installment.findAll = async () => [];
    let released = false;
    models.Installment.update = async () => { released = true; };
    models.Product.findByPk = async () => ({ quantity: 0, save: async () => {} });
    models.SaleReturn.create = async () => ({ id: 1, toJSON: () => ({}) });
    models.SaleReturn.findAll = async () => fullyReturned
      ? [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }]
      : [{ productId: 1, quantity: 1 }];
    let result;
    const res = { status(code) { assert.equal(code, 201); return this; }, json(body) { result = body; } };
    await returns.createReturn({ body: { saleId: 9, returnType: "return", productId: 1 }, user: { id: 1 }, headers: {}, socket: {} }, res);
    models.Installment.findAll = previousFindAll;
    assert.equal(committed, true);
    assert.equal(sale.status, fullyReturned ? "cancelled" : "active");
    assert.equal(sale.remainingAmount, fullyReturned ? 0 : 80);
    assert.equal(released, fullyReturned);
    assert.equal(result.message, "Sale return/exchange processed successfully");
  }
});
