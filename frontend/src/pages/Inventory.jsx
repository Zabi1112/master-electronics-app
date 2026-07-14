import { Fragment, useEffect, useMemo, useState } from "react";
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
  fundingSource: "",
  partnerId: "",
  investorId: "",
};

const emptyRestockForm = {
  quantity: "",
  purchasePrice: "",
  fundingSource: "",
  partnerId: "",
  investorId: "",
  purchaseDate: "",
};

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [restockingProduct, setRestockingProduct] = useState(null);
  const [restockForm, setRestockForm] = useState(emptyRestockForm);
  const [expandedBatchesId, setExpandedBatchesId] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "",
  });

  const loadProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const [productsRes, partnersRes, investorsRes] = await Promise.all([
        api.get("/products"),
        api.get("/partners"),
        api.get("/investors"),
      ]);
      setProducts(productsRes.data);
      setPartners(partnersRes.data || []);
      setInvestors(investorsRes.data || []);
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
      const batches = p.batches || [];
      return (
        sum +
        batches.reduce(
          (batchSum, b) =>
            batchSum + Number(b.remainingQuantity || 0) * Number(b.purchasePrice || 0),
          0
        )
      );
    }, 0);

    const expectedSaleValue = products.reduce((sum, p) => {
      const batches = p.batches || [];
      const remainingQty = batches.reduce(
        (qtySum, b) => qtySum + Number(b.remainingQuantity || 0),
        0
      );
      return sum + Number(p.salePrice || 0) * remainingQty;
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

    if (!editingId && !form.fundingSource) {
      setError("Please select who funded this purchase");
      return;
    }

    try {
      if (editingId) {
        const payload = {
          productName: form.productName,
          category: form.category,
          brand: form.brand,
          model: form.model,
          serialNumber: form.serialNumber,
          imeiNumber: form.imeiNumber,
          salePrice: Number(form.salePrice || 0),
          lowStockAlertQty: Number(form.lowStockAlertQty || 1),
          warrantyInfo: form.warrantyInfo,
          status: form.status,
          notes: form.notes,
        };

        await api.put(`/products/${editingId}`, payload);
      } else {
        const payload = {
          ...form,
          purchasePrice: Number(form.purchasePrice || 0),
          salePrice: Number(form.salePrice || 0),
          quantity: Number(form.quantity || 0),
          lowStockAlertQty: Number(form.lowStockAlertQty || 1),
          partnerId: form.fundingSource === "partner" ? form.partnerId : null,
          investorId: form.fundingSource === "investor" ? form.investorId : null,
        };

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
    setRestockingProduct(null);
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
      fundingSource: product.fundingSource || "",
      partnerId: product.partnerId || "",
      investorId: product.investorId || "",
    });

    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  };

  const openRestock = (product) => {
    setFormOpen(false);
    setEditingId(null);
    setRestockingProduct(product);
    setRestockForm({ ...emptyRestockForm, purchasePrice: product.purchasePrice || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelRestock = () => {
    setRestockingProduct(null);
    setRestockForm(emptyRestockForm);
  };

  const submitRestock = async (e) => {
    e.preventDefault();
    setError("");

    if (!restockForm.fundingSource) {
      setError("Please select who funded this restock");
      return;
    }

    try {
      await api.post(`/products/${restockingProduct.id}/restock`, {
        quantity: Number(restockForm.quantity || 0),
        purchasePrice: Number(restockForm.purchasePrice || 0),
        fundingSource: restockForm.fundingSource,
        partnerId: restockForm.fundingSource === "partner" ? restockForm.partnerId : null,
        investorId: restockForm.fundingSource === "investor" ? restockForm.investorId : null,
        purchaseDate: restockForm.purchaseDate || undefined,
      });

      cancelRestock();
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Restock failed");
    }
  };

  const toggleBatches = (productId) => {
    setExpandedBatchesId((current) => (current === productId ? null : productId));
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

  const fundingLabel = (product) => {
    if (product.fundingSource === "partner") {
      return product.fundingPartner?.name || "Partner";
    }
    if (product.fundingSource === "investor") {
      return product.fundingInvestor?.name || "Investor";
    }
    if (product.fundingSource === "shop") {
      return "Shop";
    }
    return "-";
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

            {!editingId && (
              <input
                name="purchasePrice"
                type="number"
                className="px-4 py-3 rounded-xl bg-white"
                placeholder="Purchase Price"
                value={form.purchasePrice}
                onChange={handleChange}
                required
              />
            )}

            <input
              name="salePrice"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Sale Price"
              value={form.salePrice}
              onChange={handleChange}
              required
            />

            {!editingId && (
              <input
                name="quantity"
                type="number"
                className="px-4 py-3 rounded-xl bg-white"
                placeholder="Quantity"
                value={form.quantity}
                onChange={handleChange}
                required
              />
            )}

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

            {!editingId && (
              <select
                name="fundingSource"
                className="px-4 py-3 rounded-xl bg-white"
                value={form.fundingSource}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fundingSource: e.target.value,
                    partnerId: e.target.value === "partner" ? form.partnerId : "",
                    investorId: e.target.value === "investor" ? form.investorId : "",
                  })
                }
                required
              >
                <option value="">Funded By...</option>
                <option value="partner">Partner</option>
                <option value="investor">Investor</option>
                <option value="shop">Shop (Recovered Money)</option>
              </select>
            )}

            {!editingId && form.fundingSource === "partner" && (
              <select
                name="partnerId"
                className="px-4 py-3 rounded-xl bg-white"
                value={form.partnerId}
                onChange={handleChange}
                required
              >
                <option value="">Select Partner...</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {!editingId && form.fundingSource === "investor" && (
              <select
                name="investorId"
                className="px-4 py-3 rounded-xl bg-white"
                value={form.investorId}
                onChange={handleChange}
                required
              >
                <option value="">Select Investor...</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
            )}

            {editingId && (
              <p className="text-sm text-gray-400 md:col-span-2 xl:col-span-3">
                Purchase price, quantity and funding source can't be edited here — use{" "}
                <strong className="text-yellow-400">+ Restock</strong> on the product to add
                stock at a new price/funder.
              </p>
            )}

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

      {restockingProduct && (
        <form
          onSubmit={submitRestock}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Restock: {restockingProduct.productName}
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Current stock: {restockingProduct.quantity} @ Rs.{" "}
            {Number(restockingProduct.purchasePrice || 0).toLocaleString()} (latest price)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Quantity to Add"
              value={restockForm.quantity}
              onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
              required
            />

            <input
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Purchase Price (this batch)"
              value={restockForm.purchasePrice}
              onChange={(e) =>
                setRestockForm({ ...restockForm, purchasePrice: e.target.value })
              }
              required
            />

            <input
              type="date"
              className="px-4 py-3 rounded-xl bg-white"
              value={restockForm.purchaseDate}
              onChange={(e) =>
                setRestockForm({ ...restockForm, purchaseDate: e.target.value })
              }
            />

            <select
              className="px-4 py-3 rounded-xl bg-white"
              value={restockForm.fundingSource}
              onChange={(e) =>
                setRestockForm({
                  ...restockForm,
                  fundingSource: e.target.value,
                  partnerId: e.target.value === "partner" ? restockForm.partnerId : "",
                  investorId: e.target.value === "investor" ? restockForm.investorId : "",
                })
              }
              required
            >
              <option value="">Funded By...</option>
              <option value="partner">Partner</option>
              <option value="investor">Investor</option>
              <option value="shop">Shop (Recovered Money)</option>
            </select>

            {restockForm.fundingSource === "partner" && (
              <select
                className="px-4 py-3 rounded-xl bg-white"
                value={restockForm.partnerId}
                onChange={(e) => setRestockForm({ ...restockForm, partnerId: e.target.value })}
                required
              >
                <option value="">Select Partner...</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {restockForm.fundingSource === "investor" && (
              <select
                className="px-4 py-3 rounded-xl bg-white"
                value={restockForm.investorId}
                onChange={(e) => setRestockForm({ ...restockForm, investorId: e.target.value })}
                required
              >
                <option value="">Select Investor...</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              type="button"
              onClick={cancelRestock}
              className="bg-gray-700 text-white font-bold py-3 rounded-xl"
            >
              Cancel
            </button>

            <button className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
              Save Restock
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
                  <th className="p-3 text-left">Funded By</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <Fragment key={product.id}>
                    <tr
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

                      <td className="p-3 text-sm">{fundingLabel(product)}</td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openRestock(product)}
                          className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold mr-2"
                        >
                          + Stock
                        </button>

                        <button
                          onClick={() => toggleBatches(product.id)}
                          className="bg-gray-700 text-white px-3 py-2 rounded-lg font-bold mr-2"
                        >
                          {expandedBatchesId === product.id ? "Hide" : "History"}
                        </button>

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

                    {expandedBatchesId === product.id && (
                      <tr className="border-t border-yellow-600/10 bg-black/40">
                        <td colSpan={8} className="p-3">
                          <BatchHistory batches={product.batches} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
                  <Info label="Funded By" value={fundingLabel(product)} />
                </div>

                {product.warrantyInfo && (
                  <div className="mt-3 text-sm">
                    <p className="text-gray-500">Warranty</p>
                    <p>{product.warrantyInfo}</p>
                  </div>
                )}

                {expandedBatchesId === product.id && (
                  <div className="mt-3">
                    <BatchHistory batches={product.batches} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => openRestock(product)}
                    className="bg-green-600 text-white py-3 rounded-xl font-bold"
                  >
                    + Stock
                  </button>

                  <button
                    onClick={() => toggleBatches(product.id)}
                    className="bg-gray-700 text-white py-3 rounded-xl font-bold"
                  >
                    {expandedBatchesId === product.id ? "Hide History" : "History"}
                  </button>

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

const BatchHistory = ({ batches }) => {
  if (!batches?.length) {
    return <p className="text-gray-400 text-sm">No purchase batches recorded yet.</p>;
  }

  const fundingLabel = (batch) => {
    if (batch.fundingSource === "partner") return batch.fundingPartner?.name || "Partner";
    if (batch.fundingSource === "investor") return batch.fundingInvestor?.name || "Investor";
    if (batch.fundingSource === "shop") return "Shop";
    return "-";
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-yellow-400 font-bold uppercase">Purchase Batches</p>
      {batches.map((batch) => (
        <div
          key={batch.id}
          className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-black/40 border border-yellow-600/10 rounded-xl p-3 text-xs text-gray-200"
        >
          <span className="text-yellow-300 font-bold">{batch.purchaseDate}</span>
          <span>Qty: {batch.quantity}</span>
          <span>Remaining: {batch.remainingQuantity}</span>
          <span>Price: Rs. {Number(batch.purchasePrice || 0).toLocaleString()}</span>
          <span>Funded by: {fundingLabel(batch)}</span>
        </div>
      ))}
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