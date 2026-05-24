const express = require("express");
const { getDashboardStats } = require("../controllers/dashboardController");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get(
  "/stats",
  allowRoles("admin", "manager", "accounts"),
  getDashboardStats
);

module.exports = router;