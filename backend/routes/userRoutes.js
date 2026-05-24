const express = require("express");

const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  resetPassword,
  deleteUser,
} = require("../controllers/userController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.put("/:id/reset-password", resetPassword);
router.delete("/:id", deleteUser);

module.exports = router;