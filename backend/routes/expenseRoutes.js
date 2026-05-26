const express = require("express");

const {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getMonthlyExpenseReport,
} = require("../controllers/expenseController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get(
  "/summary",
  allowRoles("admin", "manager", "accounts"),
  getExpenseSummary
);

router.get(
  "/reports/monthly",
  allowRoles("admin", "manager", "accounts"),
  getMonthlyExpenseReport
);

router.post(
  "/",
  allowRoles("admin", "manager", "accounts"),
  createExpense
);

router.get(
  "/",
  allowRoles("admin", "manager", "accounts"),
  getExpenses
);

router.get(
  "/:id",
  allowRoles("admin", "manager", "accounts"),
  getExpenseById
);

router.put(
  "/:id",
  allowRoles("admin", "manager", "accounts"),
  updateExpense
);

router.delete(
  "/:id",
  allowRoles("admin"),
  deleteExpense
);

module.exports = router;