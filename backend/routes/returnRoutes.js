const express = require("express");
const {
  createReturn,
  getReturns,
  getReturnById,
} = require("../controllers/returnController");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", allowRoles("admin", "manager", "salesman"), createReturn);
router.get(
  "/",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getReturns
);
router.get(
  "/:id",
  allowRoles("admin", "manager", "salesman", "accounts"),
  getReturnById
);

module.exports = router;
