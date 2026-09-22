import { test } from "node:test";
import assert from "node:assert/strict";
import { requireJsonResponse, readDashboardResponses } from "../src/api/responseValidation.js";
const valid = () => [{ data: { sales: {}, installments: {}, inventory: {} } }, { data: [] }, { data: [] }, { data: [] }];
test("rejects HTML returned with HTTP 200 instead of allowing render crash", () => {
  assert.throws(() => requireJsonResponse({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, data: "<!doctype html>" }), /data service/);
  assert.throws(() => requireJsonResponse({ headers: {}, data: "  <!DOCTYPE html>" }), /data service/);
});
test("accepts JSON responses and empty arrays", () => {
  const response = { headers: { "content-type": "application/json" }, data: [] };
  assert.equal(requireJsonResponse(response), response);
  assert.deepEqual(readDashboardResponses(valid()).sales, []);
});
test("validates all dashboard responses before committing state", () => {
  for (let index = 0; index < 4; index++) {
    const responses = valid(); responses[index].data = "<!doctype html>";
    assert.throws(() => readDashboardResponses(responses), /could not be loaded/);
  }
  const responses = valid(); responses[1].data = { message: "unavailable" };
  assert.throws(() => readDashboardResponses(responses), /could not be loaded/);
});
test("sales chart excludes cancelled sales", () => {
  const responses = valid(); responses[1].data = [{ id: 1, status: "active" }, { id: 2, status: "cancelled" }];
  assert.deepEqual(readDashboardResponses(responses).sales.map(sale => sale.id), [1]);
});
