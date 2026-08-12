const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
// To this:
const { connectDB, getSequelize } = require("./config/db");

const app = express();

// CORS configuration with credentials support
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://localhost",
      "capacitor://localhost",
      "https://master-electronics-app.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Master Electronics API Running");
});
const PORT = process.env.PORT || 5000;

// Validate required environment variables
const validateEnv = () => {
  const required = ["JWT_SECRET"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      `Warning: Missing environment variables: ${missing.join(", ")}`
    );
    console.warn(
      "JWT_SECRET is required for token validation. Set it in .env or Vercel environment variables."
    );
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing critical env vars: ${missing.join(", ")}`);
    }
  }
};

const registerRoutes = () => {
  const authRoutes = require("./routes/authRoutes");
  const userRoutes = require("./routes/userRoutes");
  const customerRoutes = require("./routes/customerRoutes");
  const productRoutes = require("./routes/productRoutes");
  const saleRoutes = require("./routes/saleRoutes");
  const installmentRoutes = require("./routes/installmentRoutes");
  const partnerRoutes = require("./routes/partnerRoutes");
  const investorRoutes = require("./routes/investorRoutes");
  const shopAccountRoutes = require("./routes/shopAccountRoutes");
  const dashboardRoutes = require("./routes/dashboardRoutes");
  const reportRoutes = require("./routes/reportRoutes");
  const financeRoutes = require("./routes/financeRoutes");
  const expenseRoutes = require("./routes/expenseRoutes");
  const activityRoutes = require("./routes/activityRoutes");
  const returnRoutes = require("./routes/returnRoutes");

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/sales", saleRoutes);
  app.use("/api/returns", returnRoutes);
  app.use("/api/installments", installmentRoutes);
  app.use("/api/partners", partnerRoutes);
  app.use("/api/investors", investorRoutes);
  app.use("/api/shop-account", shopAccountRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/activity-logs", activityRoutes);
};

const initializeApp = async () => {
  validateEnv();

  await connectDB();
  require("./models");
  console.log("Models initialized");

  if (process.env.NODE_ENV !== "production") {
    await getSequelize().sync({ alter: true });
  } else {
    await getSequelize().sync();
  }
  console.log("Tables synced");

  const { backfillProductBatches } = require("./scripts/backfillProductBatches");
  const { migrated } = await backfillProductBatches();
  if (migrated) {
    console.log(`Backfilled product batches for ${migrated} product(s)`);
  }

  const { backfillSaleItems } = require("./scripts/backfillSaleItems");
  const { migrated: itemsMigrated } = await backfillSaleItems();
  if (itemsMigrated) {
    console.log(`Backfilled sale items for ${itemsMigrated} sale(s)`);
  }
};

// Cold starts (a fresh serverless instance) need connectDB() + sync() +
// the backfill script to finish before any request touches the DB. This
// gate makes every request — including several that land concurrently on
// the very first cold request — await the SAME initialization promise
// instead of racing ahead of it or each triggering their own redundant
// sync()/backfill run. If init fails (e.g. a transient DB blip during cold
// start), the promise is cleared so the next request retries instead of
// this instance being silently broken for its whole warm lifetime.
let initPromise = null;

const ensureInitialized = () => {
  if (!initPromise) {
    initPromise = initializeApp().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
};

app.use((req, res, next) => {
  ensureInitialized().then(
    () => next(),
    (error) => {
      console.error("Request blocked, initialization failed:", error.message);
      res.status(503).json({
        message: "Service is starting up, please try again",
      });
    }
  );
});

registerRoutes();

if (require.main === module) {
  ensureInitialized()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start server:", error.message);
      process.exit(1);
    });
} else {
  // Kick off initialization immediately on cold start rather than waiting
  // for the first request to trigger it — the gate middleware above still
  // awaits it either way, this just gets a head start.
  ensureInitialized().catch(() => {});
}

module.exports = app;