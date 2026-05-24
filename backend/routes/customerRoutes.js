const express = require("express");

const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post(
  "/",
  allowRoles("admin", "manager", "salesman"),
  createCustomer
);

router.get(
  "/",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getCustomers
);

router.get(
  "/:id",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getCustomerById
);

router.put(
  "/:id",
  allowRoles("admin", "manager"),
  updateCustomer
);

router.delete(
  "/:id",
  allowRoles("admin"),
  deleteCustomer
);

module.exports = router;