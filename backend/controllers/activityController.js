const { Op } = require("sequelize");
const { ActivityLog, User } = require("../models");

const buildWhere = (query) => {
  const { module, action, userId, from, to } = query;

  const where = {};

  if (module) where.module = module;
  if (action) where.action = action;
  if (userId) where.userId = userId;

  if (from || to) {
    where.createdAt = {};

    if (from) {
      where.createdAt[Op.gte] = new Date(`${from}T00:00:00`);
    }

    if (to) {
      where.createdAt[Op.lte] = new Date(`${to}T23:59:59`);
    }
  }

  return where;
};

exports.getActivityLogs = async (req, res) => {
  try {
    const where = buildWhere(req.query);

    const logs = await ActivityLog.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "username", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: Number(req.query.limit || 100),
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({
      message: "Get activity logs failed",
      error: error.message,
    });
  }
};

exports.getActivityLogById = async (req, res) => {
  try {
    const log = await ActivityLog.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "username", "role"],
        },
      ],
    });

    if (!log) {
      return res.status(404).json({ message: "Activity log not found" });
    }

    res.json(log);
  } catch (error) {
    res.status(500).json({
      message: "Get activity log failed",
      error: error.message,
    });
  }
};