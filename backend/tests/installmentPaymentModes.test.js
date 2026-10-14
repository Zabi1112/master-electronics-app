const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
let state;
const row = data => Object.assign(data, { save: async () => {}, toJSON() { return { ...this, save: undefined, toJSON: undefined }; } });
const models = {
  Sale: { findByPk: async () => state.sale },
  Installment: {
    findByPk: async id => state.items.find(i => i.id === Number(id)),
    findAll: async ({ where }) => state.items.filter(i => i.installmentNo > where.installmentNo[Op.gt] && ["pending", "partial"].includes(i.status)),
    max: async () => Math.max(...state.items.map(i => i.installmentNo)),
    count: async () => state.items.filter(i => ["pending", "partial"].includes(i.status)).length,
    create: async data => { const item = row({ id: state.items.length + 1, ...data }); state.items.push(item); return item; },
  },
  ShopTransaction: { create: async data => { state.collections.push(data); } },
  ActivityLog: { create: async data => { state.logs.push(data); } },
  SaleItem: {}, Customer: {}, User: {}, Product: {},
};
const db = { transaction: async () => {
  const snapshot = JSON.stringify(state);
  return { LOCK: { UPDATE: "UPDATE" }, commit: async () => {}, rollback: async () => {
    state = JSON.parse(snapshot); state.sale = row(state.sale); state.items = state.items.map(row);
  } };
} };
require.cache[require.resolve("../models")] = { exports: models };
require.cache[require.resolve("../config/db")] = { exports: { getSequelize: () => db } };
require.cache[require.resolve("../controllers/shopAccountController")] = { exports: { recalculateShopBalance: async () => {} } };
const { payInstallment } = require("../controllers/installmentController");
function setup(future = true) {
 state = { sale: row({ id: 1, status: "active", paidAmount: 0, remainingAmount: future ? 200 : 100,
 finalAmount: future ? 200 : 100, purchasePrice: 50, profit: future ? 150 : 50, installmentMonths: 3, invoiceNo: "TEST" }),
 items: [row({ id: 1, saleId: 1, customerId: 1, installmentNo: future ? 2 : 3, amount: 100,
 remainingAmount: 100, paidAmount: 0, dueDate: "2098-01-01", finePercentPerDay: 0, status: "pending" })], collections: [], logs: [] };
 if (future) state.items.push(row({ ...state.items[0], id: 2, installmentNo: 3 }));
}
async function pay(body, id = 1) {
 let status = 200, result;
 await payInstallment({ body, params: { id }, user: { id: 1, role: "admin" }, headers: {} }, {
 status(code) { status = code; return this; }, json(data) { result = data; },
 });
 return { status, result };
}
test("partial payments stay on the same installment and accumulate until cleared", async () => {
 setup(); assert.equal((await pay({ amount: 30, paymentMode: "partial" })).status, 200);
 assert.equal(state.items[0].status, "partial"); assert.equal(state.items[0].remainingAmount, 70);
 assert.equal(state.items[1].remainingAmount, 100);
 assert.equal((await pay({ amount: 20, paymentMode: "partial" })).status, 200);
 assert.equal(state.items[0].paidAmount, 50);
 assert.equal((await pay({ amount: 50, paymentMode: "partial" })).status, 200);
 assert.equal(state.items[0].status, "paid"); assert.equal(state.sale.remainingAmount, 100);
 assert.equal(state.collections.reduce((n, t) => n + t.amount, 0), 100);
});
test("complete remains the default and carries a shortfall forward", async () => {
 setup(); assert.equal((await pay({ amount: 30 })).status, 200);
 assert.equal(state.items[0].status, "paid"); assert.equal(state.items[1].remainingAmount, 170);
 assert.equal(state.sale.remainingAmount, 170);
});
test("last installment extends the actual unpaid balance without changing sale price or plan category", async () => {
 setup(false); const response = await pay({ amount: 30, paymentMode: "extend", extensionDueDate: "2098-02-01" });
 assert.equal(response.status, 200); assert.equal(state.items[0].status, "paid");
 assert.equal(state.items[1].remainingAmount, 70); assert.equal(state.items[1].installmentNo, 4);
 assert.equal(state.sale.remainingAmount, 70); assert.equal(state.sale.finalAmount, 100);
 assert.equal(state.sale.status, "active"); assert.equal(state.sale.installmentMonths, 3);
 assert.equal(state.sale.expectedClearDate, "2098-02-01");
 assert.equal((await pay({ amount: 20, paymentMode: "partial" }, 2)).status, 200);
 assert.equal((await pay({ amount: 50 }, 2)).status, 200);
 assert.equal(state.sale.status, "cleared"); assert.equal(state.sale.paidAmount, 100);
});
test("a short final payment requires an explicit partial or extension choice", async () => {
 setup(false); assert.equal((await pay({ amount: 30 })).status, 400);
 assert.equal(state.sale.remainingAmount, 100); assert.equal(state.collections.length, 0);
 assert.equal((await pay({ amount: 30, paymentMode: "partial" })).status, 200);
 assert.equal(state.items[0].remainingAmount, 70);
});
test("invalid extensions and payments roll back", async () => {
 for (const body of [
  { amount: 30, paymentMode: "extend", extensionDueDate: "2098-02-30" },
  { amount: 30, paymentMode: "extend", extensionDueDate: "2020-01-01" },
  { amount: 101, paymentMode: "partial" }, { amount: "Infinity" },
  { amount: 30, fineDiscount: -1 }, { amount: 30, paymentMode: "other" },
  { amount: 30, paymentMode: "partial", newFinalAmount: 30, notes: "test" },
 ]) { setup(false); assert.equal((await pay(body)).status, 400); assert.equal(state.sale.remainingAmount, 100); assert.equal(state.collections.length, 0); }
 setup(); assert.equal((await pay({ amount: 30, paymentMode: "extend", extensionDueDate: "2098-02-01" })).status, 400);
});

test("extensions can be extended again using the actual final schedule row", async () => {
 setup(false);
 assert.equal((await pay({ amount: 30, paymentMode: "extend", extensionDueDate: "2098-02-01" })).status, 200);
 assert.equal((await pay({ amount: 20, paymentMode: "extend", extensionDueDate: "2098-03-01" }, 2)).status, 200);
 assert.equal(state.items[2].installmentNo, 5); assert.equal(state.items[2].remainingAmount, 50);
 assert.equal(state.sale.remainingAmount, 50);
});
test("cancelled and already-paid installments cannot accept more payments", async () => {
 setup(false); state.sale.status = "cancelled";
 assert.equal((await pay({ amount: 20, paymentMode: "partial" })).status, 400);
 assert.equal(state.collections.length, 0);
 setup(false); assert.equal((await pay({ amount: 100 })).status, 200);
 assert.equal((await pay({ amount: 20, paymentMode: "partial" })).status, 400);
 assert.equal(state.sale.paidAmount, 100);
});
test("extension collects only the actual payment, including its fine", async () => {
 setup(false); state.items[0].dueDate = "2020-01-01"; state.items[0].finePercentPerDay = 0.001;
 const days = Math.floor((new Date().setHours(0,0,0,0) - new Date("2020-01-01").setHours(0,0,0,0)) / 86400000);
 const fine = Math.round(100 * 0.001 / 100 * days);
 const response = await pay({ amount: 30 + fine, paymentMode: "extend", extensionDueDate: "2098-02-01" });
 assert.equal(response.status, 200); assert.equal(state.items[1].remainingAmount, 70);
 assert.equal(state.sale.paidAmount, 30);
 assert.equal(state.collections.reduce((n, t) => n + t.amount, 0), 30 + fine);
});
