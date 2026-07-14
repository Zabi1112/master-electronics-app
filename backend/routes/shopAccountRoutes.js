const express = require("express");

const {
  getShopAccount,
  getShopTransactions,
  addShopAdjustment,
} = require("../controllers/shopAccountController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", allowRoles("admin", "manager", "accounts"), getShopAccount);

router.get(
  "/transactions",
  allowRoles("admin", "manager", "accounts"),
  getShopTransactions
);

router.post("/adjustments", allowRoles("admin"), addShopAdjustment);

module.exports = router;
