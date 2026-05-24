const express = require("express");

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", allowRoles("admin", "manager"), createProduct);

router.get(
  "/",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getProducts
);

router.get(
  "/:id",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getProductById
);

router.put("/:id", allowRoles("admin", "manager"), updateProduct);

router.delete("/:id", allowRoles("admin"), deleteProduct);

module.exports = router;