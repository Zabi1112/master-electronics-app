export function requireJsonResponse(response) {
  const type = String(response.headers?.["content-type"] || "").toLowerCase();
  if (type.includes("text/html") || (typeof response.data === "string" && /^\s*(<!doctype html|<html)/i.test(response.data))) {
    throw new Error("The data service is unavailable. Please try again shortly.");
  }
  return response;
}

export function readDashboardResponses([stats, sales, products, overdue]) {
  if (!stats.data || typeof stats.data !== "object" || Array.isArray(stats.data) ||
      !stats.data.sales || !stats.data.installments || !stats.data.inventory ||
      ![sales.data, products.data, overdue.data].every(Array.isArray)) {
    throw new Error("Dashboard data could not be loaded. Please try again.");
  }
  return { stats: stats.data, sales: sales.data.filter(sale => sale.status !== "cancelled"),
    products: products.data, overdue: overdue.data };
}
