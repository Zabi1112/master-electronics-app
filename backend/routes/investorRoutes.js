const express = require("express");

const {
  createInvestor,
  getInvestors,
  getInvestorById,
  updateInvestor,
  deleteInvestor,
  addInvestorTransaction,
  getInvestorTransactions,
} = require("../controllers/investorController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", allowRoles("admin"), createInvestor);

router.get("/", allowRoles("admin", "manager", "accounts"), getInvestors);

router.get("/:id", allowRoles("admin", "manager", "accounts"), getInvestorById);

router.put("/:id", allowRoles("admin"), updateInvestor);

router.delete("/:id", allowRoles("admin"), deleteInvestor);

router.post(
  "/:id/transactions",
  allowRoles("admin", "accounts"),
  addInvestorTransaction
);

router.get(
  "/:id/transactions",
  allowRoles("admin", "manager", "accounts"),
  getInvestorTransactions
);

module.exports = router;
