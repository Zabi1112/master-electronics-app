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

const startServer = async () => {
  try {
    validateEnv();

    await connectDB();
    await getSequelize().sync();
    //await getSequelize().sync({ alter: true });
    console.log("Tables synced");

    // Load models FIRST to ensure they are initialized before routes
    require("./models");
    console.log("Models initialized");

    const authRoutes = require("./routes/authRoutes");
    const userRoutes = require("./routes/userRoutes");
    const customerRoutes = require("./routes/customerRoutes");
    const productRoutes = require("./routes/productRoutes");
    const saleRoutes = require("./routes/saleRoutes");
    const installmentRoutes = require("./routes/installmentRoutes");
    const partnerRoutes = require("./routes/partnerRoutes");
    const dashboardRoutes = require("./routes/dashboardRoutes");
    const reportRoutes = require("./routes/reportRoutes");
    const financeRoutes = require("./routes/financeRoutes");
    const expenseRoutes = require("./routes/expenseRoutes");
    const activityRoutes = require("./routes/activityRoutes");

    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/customers", customerRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/sales", saleRoutes);
    app.use("/api/installments", installmentRoutes);
    app.use("/api/partners", partnerRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/reports", reportRoutes);
    app.use("/api/finance", financeRoutes);
    app.use("/api/expenses", expenseRoutes);
    app.use("/api/activity-logs", activityRoutes);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();