import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const emptyForm = {
  productName: "",
  category: "",
  brand: "",
  model: "",
  serialNumber: "",
  imeiNumber: "",
  purchasePrice: "",
  salePrice: "",
  quantity: 1,
  lowStockAlertQty: 1,
  warrantyInfo: "",
  status: "in_stock",
  notes: "",
};

const statusLabels = {
  in_stock: "In Stock",
  sold: "Sold",
  returned: "Returned",
  damaged: "Damaged",
};

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const summary = useMemo(() => {
    const inventoryValue = products.reduce((sum, p) => {
      if (p.status === "in_stock") {
        return sum + Number(p.purchasePrice || 0) * Number(p.quantity || 0);
      }
      return sum;
    }, 0);

    const expectedSaleValue = products.reduce((sum, p) => {
      if (p.status === "in_stock") {
        return sum + Number(p.salePrice || 0) * Number(p.quantity || 0);
      }
      return sum;
    }, 0);

    const lowStock = products.filter(
      (p) =>
        Number(p.quantity || 0) > 0 &&
        Number(p.quantity || 0) <= Number(p.lowStockAlertQty || 1)
    );

    const outOfStock = products.filter(
      (p) => Number(p.quantity || 0) <= 0 || p.status === "sold"
    );

    return {
      total: products.length,
      inventoryValue,
      expectedSaleValue,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    };
  }, [products]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((old) => ({ ...old, [name]: value }));
  };

  const createProduct = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice || 0),
        salePrice: Number(form.salePrice || 0),
        quantity: Number(form.quantity || 0),
        lowStockAlertQty: Number(form.lowStockAlertQty || 1),
      };

      await api.post("/products", payload);
      setForm(emptyForm);
      setFormOpen(false);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Create product failed");
    }
  };

  const getStockBadge = (product) => {
    const qty = Number(product.quantity || 0);
    const lowQty = Number(product.lowStockAlertQty || 1);

    if (qty <= 0 || product.status === "sold") {
      return (
        <span className="px-3 py-1 rounded-full text-xs bg-red-600/20 text-red-300">
          Out of Stock
        </span>
      );
    }

    if (qty <= lowQty) {
      return (
        <span className="px-3 py-1 rounded-full text-xs bg-orange-600/20 text-orange-300">
          Low Stock
        </span>
      );
    }

    return (
      <span className="px-3 py-1 rounded-full text-xs bg-green-600/20 text-green-300">
        In Stock
      </span>
    );
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Inventory
          </h1>
          <p className="text-gray-400 text-sm">
            Add products, track stock, low stock, and inventory value.
          </p>
        </div>

        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add Product"}
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-5 mb-6">
        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Products</p>
          <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
            {summary.total}
          </h2>
        </div>

        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Inventory Value</p>
          <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
            {summary.inventoryValue.toLocaleString()}
          </h2>
        </div>

        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Expected Sale</p>
          <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
            {summary.expectedSaleValue.toLocaleString()}
          </h2>
        </div>

        <div className="bg-black/70 border border-orange-600/30 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Low Stock</p>
          <h2 className="text-xl md:text-2xl font-bold text-orange-300">
            {summary.lowStockCount}
          </h2>
        </div>

        <div className="bg-black/70 border border-red-600/30 rounded-2xl p-4">
          <p className="text-gray-400 text-xs">Out of Stock</p>
          <h2 className="text-xl md:text-2xl font-bold text-red-300">
            {summary.outOfStockCount}
          </h2>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={createProduct}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Product Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <input
              name="productName"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Product Name"
              value={form.productName}
              onChange={handleChange}
              required
            />

            <input
              name="category"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Category e.g TV, Mobile, Fridge"
              value={form.category}
              onChange={handleChange}
              required
            />

            <input
              name="brand"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Brand"
              value={form.brand}
              onChange={handleChange}
            />

            <input
              name="model"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Model"
              value={form.model}
              onChange={handleChange}
            />

            <input
              name="serialNumber"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Serial Number"
              value={form.serialNumber}
              onChange={handleChange}
            />

            <input
              name="imeiNumber"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="IMEI Number"
              value={form.imeiNumber}
              onChange={handleChange}
            />

            <input
              name="purchasePrice"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Purchase Price"
              value={form.purchasePrice}
              onChange={handleChange}
              required
            />

            <input
              name="salePrice"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Sale Price"
              value={form.salePrice}
              onChange={handleChange}
              required
            />

            <input
              name="quantity"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Quantity"
              value={form.quantity}
              onChange={handleChange}
              required
            />

            <input
              name="lowStockAlertQty"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Low Stock Alert Quantity"
              value={form.lowStockAlertQty}
              onChange={handleChange}
            />

            <input
              name="warrantyInfo"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Warranty Info"
              value={form.warrantyInfo}
              onChange={handleChange}
            />

            <select
              name="status"
              className="px-4 py-3 rounded-xl bg-white"
              value={form.status}
              onChange={handleChange}
            >
              <option value="in_stock">In Stock</option>
              <option value="returned">Returned</option>
              <option value="damaged">Damaged</option>
            </select>

            <textarea
              name="notes"
              className="px-4 py-3 rounded-xl bg-white md:col-span-2 xl:col-span-3"
              placeholder="Notes"
              value={form.notes}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <button className="mt-5 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Save Product
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading inventory...</p>
      ) : (
        <>
          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Serial / IMEI</th>
                  <th className="p-3 text-left">Purchase</th>
                  <th className="p-3 text-left">Sale</th>
                  <th className="p-3 text-left">Qty</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">
                      <div className="font-semibold text-yellow-300">
                        {product.productName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {product.brand || "-"} {product.model || ""} /{" "}
                        {product.category}
                      </div>
                    </td>

                    <td className="p-3 text-sm">
                      <div>{product.serialNumber || "-"}</div>
                      <div className="text-gray-400">{product.imeiNumber || "-"}</div>
                    </td>

                    <td className="p-3">
                      {Number(product.purchasePrice || 0).toLocaleString()}
                    </td>

                    <td className="p-3">
                      {Number(product.salePrice || 0).toLocaleString()}
                    </td>

                    <td className="p-3">{product.quantity}</td>

                    <td className="p-3">{getStockBadge(product)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">
                      {product.productName}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {product.brand || "-"} {product.model || ""} /{" "}
                      {product.category}
                    </p>
                  </div>

                  <div>{getStockBadge(product)}</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Purchase</p>
                    <p>{Number(product.purchasePrice || 0).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Sale</p>
                    <p>{Number(product.salePrice || 0).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p>{product.quantity}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Alert Qty</p>
                    <p>{product.lowStockAlertQty || 1}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Serial</p>
                    <p>{product.serialNumber || "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">IMEI</p>
                    <p>{product.imeiNumber || "-"}</p>
                  </div>
                </div>

                {product.warrantyInfo && (
                  <div className="mt-3 text-sm">
                    <p className="text-gray-500">Warranty</p>
                    <p>{product.warrantyInfo}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Inventory;