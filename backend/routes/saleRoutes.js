const express = require("express");

const {
  createSale,
  getSales,
  getSaleById,
  getInstallments,
} = require("../controllers/saleController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post(
  "/",
  allowRoles("admin", "manager", "salesman"),
  createSale
);

router.get(
  "/",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getSales
);

router.get(
  "/installments",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getInstallments
);

router.get(
  "/:id",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getSaleById
);

module.exports = router;