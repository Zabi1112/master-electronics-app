const PRODUCTION_API = "https://master-electronics-app.vercel.app/_backend/api";

export function resolveApiBaseUrl({ configured, production, native }) {
  const value = configured?.trim().replace(/\/+$/, "");
  // Web previews must call their own deployment, rather than production.
  // Native apps still need an absolute URL because they run on localhost.
  if (production && !native && (!value || value === PRODUCTION_API)) return "/_backend/api";
  return value || (production || native ? PRODUCTION_API : "http://localhost:5000/api");
}
