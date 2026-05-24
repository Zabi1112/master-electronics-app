const express = require("express");

const {
  getSettings,
  updateSettings,
  getCurrentDonationDue,
  markDonationPaid,
  getDonationRecords,
  calculatePartnerProfitShares,
  creditPartnerProfitShares,
} = require("../controllers/financeController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get(
  "/settings",
  allowRoles("admin", "manager", "accounts"),
  getSettings
);

router.put(
  "/settings",
  allowRoles("admin"),
  updateSettings
);

router.get(
  "/donation/current",
  allowRoles("admin", "manager", "accounts"),
  getCurrentDonationDue
);

router.put(
  "/donation/mark-paid",
  allowRoles("admin", "accounts"),
  markDonationPaid
);

router.get(
  "/donation/records",
  allowRoles("admin", "manager", "accounts"),
  getDonationRecords
);

router.get(
  "/partners/profit-shares",
  allowRoles("admin", "manager", "accounts"),
  calculatePartnerProfitShares
);

router.post(
  "/partners/credit-profit-shares",
  allowRoles("admin"),
  creditPartnerProfitShares
);

module.exports = router;