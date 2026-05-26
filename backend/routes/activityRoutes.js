const express = require("express");

const {
  getActivityLogs,
  getActivityLogById,
} = require("../controllers/activityController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get(
  "/",
  allowRoles("admin", "manager"),
  getActivityLogs
);

router.get(
  "/:id",
  allowRoles("admin", "manager"),
  getActivityLogById
);

module.exports = router;