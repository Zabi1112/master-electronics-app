// Services forwards the original public path. Keep existing web and Android
// /_backend URLs compatible with the Express application's /api routes.
module.exports = function servicePrefix(req, res, next) {
  if (/^\/_backend(?:\/|\?|$)/.test(req.url)) {
    req.url = req.url.slice("/_backend".length) || "/";
    if (req.url.startsWith("?")) req.url = "/" + req.url;
  }
  next();
};
