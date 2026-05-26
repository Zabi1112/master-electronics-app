const { ActivityLog } = require("../models");

const logActivity = async ({
  req,
  action,
  module,
  recordId = null,
  description = "",
  oldData = null,
  newData = null,
}) => {
  try {
    await ActivityLog.create({
      userId: req.user?.id || null,
      action,
      module,
      recordId,
      description,
      oldData,
      newData,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    });
  } catch (error) {
    console.error("Activity log failed:", error.message);
  }
};

module.exports = logActivity;