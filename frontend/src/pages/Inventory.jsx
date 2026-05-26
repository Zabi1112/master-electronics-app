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

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
  });

  const loadProducts = async () => {
    setLoading(true);
    setError("");

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

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const text = `${p.productName || ""} ${p.category || ""} ${
        p.brand || ""
      } ${p.model || ""} ${p.serialNumber || ""} ${
        p.imeiNumber || ""
      }`.toLowerCase();

      const matchesSearch = text.includes(filters.search.toLowerCase());
      const matchesCategory =
        !filters.category ||
        p.category?.toLowerCase() === filters.category.toLowerCase();
      const matchesStatus = !filters.status || p.status === filters.status;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, filters]);

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))];
  }, [products]);

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

  const submitProduct = async (e) => {
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

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post("/products", payload);
      }

      setForm(emptyForm);
      setEditingId(null);
      setFormOpen(false);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Save product failed");
    }
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setForm({
      productName: product.productName || "",
      category: product.category || "",
      brand: product.brand || "",
      model: product.model || "",
      serialNumber: product.serialNumber || "",
      imeiNumber: product.imeiNumber || "",
      purchasePrice: product.purchasePrice || "",
      salePrice: product.salePrice || "",
      quantity: product.quantity || 0,
      lowStockAlertQty: product.lowStockAlertQty || 1,
      warrantyInfo: product.warrantyInfo || "",
      status: product.status || "in_stock",
      notes: product.notes || "",
    });

    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  };

  const deleteProduct = async (id) => {
    const ok = window.confirm("Delete this product?");
    if (!ok) return;

    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Delete product failed");
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
            Add, edit, search and manage stock.
          </p>
        </div>

        <button
          onClick={() => {
            setFormOpen(!formOpen);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add Product"}
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-5 mb-6">
        <SummaryCard title="Products" value={summary.total} />
        <SummaryCard title="Inventory Value" value={summary.inventoryValue} money />
        <SummaryCard title="Expected Sale" value={summary.expectedSaleValue} money />
        <SummaryCard title="Low Stock" value={summary.lowStockCount} orange />
        <SummaryCard title="Out of Stock" value={summary.outOfStockCount} red />
      </div>

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Search name, serial, IMEI..."
            value={filters.search}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value })
            }
          />

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
          >
            <option value="">All Status</option>
            <option value="in_stock">In Stock</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="damaged">Damaged</option>
          </select>

          <button
            onClick={() =>
              setFilters({
                search: "",
                category: "",
                status: "",
              })
            }
            className="bg-gray-700 text-white font-bold rounded-xl py-3"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={submitProduct}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            {editingId ? "Edit Product" : "Add Product"}
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
              <option value="sold">Sold</option>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-700 text-white font-bold py-3 rounded-xl"
              >
                Cancel Edit
              </button>
            )}

            <button
              className={`bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl ${
                editingId ? "" : "md:col-span-2"
              }`}
            >
              {editingId ? "Update Product" : "Save Product"}
            </button>
          </div>
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
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
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
                      <div className="text-gray-400">
                        {product.imeiNumber || "-"}
                      </div>
                    </td>

                    <td className="p-3">
                      {Number(product.purchasePrice || 0).toLocaleString()}
                    </td>

                    <td className="p-3">
                      {Number(product.salePrice || 0).toLocaleString()}
                    </td>

                    <td className="p-3">{product.quantity}</td>

                    <td className="p-3">{getStockBadge(product)}</td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => startEdit(product)}
                        className="bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold mr-2"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {filteredProducts.map((product) => (
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
                  <Info
                    label="Purchase"
                    value={Number(product.purchasePrice || 0).toLocaleString()}
                  />
                  <Info
                    label="Sale"
                    value={Number(product.salePrice || 0).toLocaleString()}
                  />
                  <Info label="Quantity" value={product.quantity} />
                  <Info
                    label="Alert Qty"
                    value={product.lowStockAlertQty || 1}
                  />
                  <Info label="Serial" value={product.serialNumber || "-"} />
                  <Info label="IMEI" value={product.imeiNumber || "-"} />
                </div>

                {product.warrantyInfo && (
                  <div className="mt-3 text-sm">
                    <p className="text-gray-500">Warranty</p>
                    <p>{product.warrantyInfo}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => startEdit(product)}
                    className="bg-yellow-500 text-black py-3 rounded-xl font-bold"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="bg-red-600 text-white py-3 rounded-xl font-bold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value, money, orange, red }) => (
  <div
    className={`bg-black/70 border rounded-2xl p-4 ${
      red
        ? "border-red-600/30"
        : orange
        ? "border-orange-600/30"
        : "border-yellow-600/30"
    }`}
  >
    <p className="text-gray-400 text-xs">{title}</p>
    <h2
      className={`text-xl md:text-2xl font-bold ${
        red ? "text-red-300" : orange ? "text-orange-300" : "text-yellow-400"
      }`}
    >
      {money ? Number(value || 0).toLocaleString() : value}
    </h2>
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold">{value}</p>
  </div>
);

export default Inventory;