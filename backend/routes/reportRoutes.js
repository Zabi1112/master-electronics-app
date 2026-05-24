const express = require("express");

const {
  salesReport,
  installmentReport,
  overdueReport,
  inventoryReport,
  partnerReport,
  partnerLedgerReport,
  profitReport,
  customerReport,
} = require("../controllers/reportController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin", "manager", "accounts"));

router.get("/sales", salesReport);
router.get("/installments", installmentReport);
router.get("/overdue", overdueReport);
router.get("/inventory", inventoryReport);
router.get("/partners", partnerReport);
router.get("/partners/:partnerId/ledger", partnerLedgerReport);
router.get("/profit", profitReport);
router.get("/customers", customerReport);

module.exports = router;