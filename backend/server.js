const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const { connectDB, sequelize } = require("./config/db");

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

require("./models");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Master Electronics API Running");
});

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
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
  await sequelize.sync();
  //await sequelize.sync({ alter: true });
  console.log("Tables synced");
});