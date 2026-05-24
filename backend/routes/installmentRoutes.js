const express = require("express");

const {
  payInstallment,
  getPendingInstallments,
  getOverdueInstallments,
  getInstallmentCustomers,
  getCustomerInstallmentItems,
  getSaleInstallments,
} = require("../controllers/installmentController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get(
  "/customers",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getInstallmentCustomers
);

router.get(
  "/customer/:customerId",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getCustomerInstallmentItems
);

router.get(
  "/sale/:saleId",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getSaleInstallments
);

router.get(
  "/pending",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getPendingInstallments
);

router.get(
  "/overdue",
  allowRoles("admin", "manager", "accounts"),
  getOverdueInstallments
);

router.put(
  "/:id/pay",
  allowRoles("admin", "manager", "salesman", "accounts"),
  payInstallment
);

module.exports = router;