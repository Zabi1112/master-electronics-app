const jwt = require("jsonwebtoken");

exports.protect = async (req, res, next) => {
  try {
    // Import User model at runtime to ensure it's initialized
    const { User } = require("../models");

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Not authorized, no token",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "User not found or inactive",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Only a genuinely bad/expired token is a 401. Anything else (e.g. the
    // User lookup failing because the DB connection pool is under
    // pressure) is an infrastructure failure, not an auth failure — the
    // frontend wipes the stored token and force-reloads to /login on any
    // 401, so misclassifying a transient DB hiccup here was logging
    // everyone out and making a slow request look like the app crashed.
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Not authorized",
        error: error.message,
      });
    }

    console.error("Auth middleware failure (not a token issue):", error.message);

    res.status(503).json({
      message: "Service temporarily unavailable, please retry",
      error: error.message,
    });
  }
};

exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
};