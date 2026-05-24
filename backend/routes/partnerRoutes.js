const express = require("express");

const {
  createPartner,
  getPartners,
  getPartnerById,
  updatePartner,
  deletePartner,
  addPartnerTransaction,
  getPartnerTransactions,
} = require("../controllers/partnerController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", allowRoles("admin"), createPartner);

router.get("/", allowRoles("admin", "manager", "accounts"), getPartners);

router.get("/:id", allowRoles("admin", "manager", "accounts"), getPartnerById);

router.put("/:id", allowRoles("admin"), updatePartner);

router.delete("/:id", allowRoles("admin"), deletePartner);

router.post(
  "/:id/transactions",
  allowRoles("admin", "accounts"),
  addPartnerTransaction
);

router.get(
  "/:id/transactions",
  allowRoles("admin", "manager", "accounts"),
  getPartnerTransactions
);

module.exports = router;