const express = require("express");

const {
  payInstallment,
  correctInstallment,
  getPendingInstallments,
  getOverdueInstallments,
  getInstallmentCustomers,
  getCustomerInstallmentItems,
  getSaleInstallments,
  getMonthlyCollections,
  getDueThisMonth,
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

router.get(
  "/monthly-collections",
  allowRoles("admin", "manager", "accounts"),
  getMonthlyCollections
);

router.get(
  "/due-this-month",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getDueThisMonth
);

router.put(
  "/:id/pay",
  allowRoles("admin", "manager", "salesman", "accounts"),
  payInstallment
);

router.put("/:id/correct", allowRoles("admin"), correctInstallment);

module.exports = router;