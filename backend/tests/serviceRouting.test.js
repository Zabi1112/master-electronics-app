const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const config = require("../../vercel.json");
const prefix = require("../middleware/servicePrefix");

test("public API routes select backend before frontend fallback", () => {
  for (const path of ["/_backend/api/sales", "/_backend", "/api/auth/login", "/api/missing", "/dashboard"]) {
    const selected = config.rewrites.find(rule => {
      const base = rule.source.replace("/:path*", "");
      return !base || path === base || path.startsWith(base + "/");
    });
    assert.equal(selected.destination.service, path === "/dashboard" ? "frontend" : "backend");
  }
});

test("Express accepts public and local API paths, preserving query strings and POST bodies", async () => {
  const app = express(); app.use(prefix); app.use(express.json());
  app.all("/api/check", (req, res) => res.json({ query: req.query, body: req.body, original: req.originalUrl }));
  app.use((req, res) => res.status(404).json({ message: "Not found" }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    for (const path of ["/_backend/api/check", "/api/check"]) {
      const response = await fetch(base + path + "?month=2026-09", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: 42 }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { query: { month: "2026-09" }, body: { value: 42 }, original: path + "?month=2026-09" });
    }
    for (const path of ["/_backend/api/missing", "/_backend-other/api/check"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404);
      assert.match(response.headers.get("content-type"), /application\/json/);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
