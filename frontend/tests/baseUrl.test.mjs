import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveApiBaseUrl } from "../src/api/baseUrl.js";
const productionUrl = "https://master-electronics-app.vercel.app/_backend/api";
test("web production and previews use their own backend even with the existing env setting", () => {
 for (const configured of [undefined, productionUrl, productionUrl + "/"]) {
  assert.equal(resolveApiBaseUrl({ configured, production: true, native: false }), "/_backend/api");
 }
});
test("native apps retain an absolute production URL", () => {
 assert.equal(resolveApiBaseUrl({ production: true, native: true }), productionUrl);
});
test("local development and deliberately configured external APIs are preserved", () => {
 assert.equal(resolveApiBaseUrl({ production: false, native: false }), "http://localhost:5000/api");
 assert.equal(resolveApiBaseUrl({ configured: "https://api.example.com/api", production: true, native: false }), "https://api.example.com/api");
});
