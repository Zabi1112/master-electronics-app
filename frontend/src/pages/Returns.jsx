import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const money = (v) => Number(v || 0).toLocaleString();

const saleLabel = (sale) => {
  const items = sale.items || [];
  if (items.length === 0) return "Product";
  const first = items[0]?.product?.productName || "Product";
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
};

const emptyForm = {
  saleId: "",
  returnType: "return",
  productId: "",
  quantity: 1,
  replacementProductId: "",
  replacementQuantity: 1,
  refundAmount: "",
  additionalCharge: "",
  reason: "",
  notes: "",
};

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [returnsRes, salesRes, productsRes] = await Promise.all([
        api.get("/returns"),
        api.get("/sales"),
        api.get("/products"),
      ]);
      setReturns(returnsRes.data || []);
      setSales(salesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load return data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedSale = useMemo(
    () => sales.find((sale) => String(sale.id) === String(form.saleId)),
    [sales, form.saleId]
  );

  const selectedSaleItem = useMemo(
    () =>
      selectedSale?.items?.find(
        (item) => String(item.productId) === String(form.productId)
      ),
    [selectedSale, form.productId]
  );

  const availableReplacement = useMemo(
    () =>
      products.filter(
        (product) => String(product.id) !== String(form.productId)
      ),
    [products, form.productId]
  );

  const handleSaleChange = (e) => {
    const saleId = e.target.value;
    const sale = sales.find((sale) => String(sale.id) === String(saleId));
    const firstItem = sale?.items?.[0];

    setForm((old) => ({
      ...old,
      saleId,
      productId: firstItem?.productId || "",
      quantity: firstItem?.quantity || 1,
      replacementProductId: "",
      replacementQuantity: firstItem?.quantity || 1,
    }));
  };

  const handleItemChange = (e) => {
    const productId = e.target.value;
    const item = selectedSale?.items?.find(
      (i) => String(i.productId) === String(productId)
    );

    setForm((old) => ({
      ...old,
      productId,
      quantity: item?.quantity || 1,
      replacementQuantity: item?.quantity || 1,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((old) => ({ ...old, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.saleId || !form.productId) {
      setError("Please select a sale and product to process.");
      return;
    }

    const payload = {
      saleId: Number(form.saleId),
      returnType: form.returnType,
      productId: Number(form.productId),
      quantity: Number(form.quantity || 1),
      refundAmount: Number(form.refundAmount || 0),
      additionalCharge: Number(form.additionalCharge || 0),
      reason: form.reason || null,
      notes: form.notes || null,
    };

    if (form.returnType === "exchange") {
      payload.replacementProductId = Number(form.replacementProductId || 0);
      payload.replacementQuantity = Number(form.replacementQuantity || 1);
    }

    try {
      await api.post("/returns", payload);
      setSuccess("Return/exchange processed successfully.");
      setForm(emptyForm);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process return");
    }
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">Returns & Exchanges</h1>
          <p className="text-gray-400 text-sm">
            Process returns and exchanges for existing sales.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 rounded-xl p-3 mb-4">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
      >
        <h2 className="text-xl font-bold text-yellow-400 mb-4">Create Return / Exchange</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <select
            name="saleId"
            className="px-4 py-3 rounded-xl bg-white"
            value={form.saleId}
            onChange={handleSaleChange}
            required
          >
            <option value="">Select Sale</option>
            {sales.map((sale) => (
              <option key={sale.id} value={sale.id}>
                {sale.invoiceNo} - {saleLabel(sale)} - {sale.customer?.name || "Walk-in"}
              </option>
            ))}
          </select>

          {selectedSale && (
            <select
              className="px-4 py-3 rounded-xl bg-white"
              value={form.productId}
              onChange={handleItemChange}
              required
            >
              <option value="">Select Item to Return</option>
              {(selectedSale.items || []).map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.product?.productName || `Product #${item.productId}`} × {item.quantity}
                </option>
              ))}
            </select>
          )}

          <select
            name="returnType"
            className="px-4 py-3 rounded-xl bg-white"
            value={form.returnType}
            onChange={handleChange}
            required
          >
            <option value="return">Return</option>
            <option value="exchange">Exchange</option>
          </select>

          <input
            name="quantity"
            type="number"
            min="1"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Return Quantity"
            value={form.quantity}
            onChange={handleChange}
            required
          />

          <div className="col-span-1 md:col-span-2 xl:col-span-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-2xl p-4">
                <p className="text-sm text-gray-400">Sale Invoice</p>
                <p className="text-white font-semibold">{selectedSale?.invoiceNo || "-"}</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-2xl p-4">
                <p className="text-sm text-gray-400">Selected Item</p>
                <p className="text-white font-semibold">{selectedSaleItem?.product?.productName || "-"}</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-2xl p-4">
                <p className="text-sm text-gray-400">Item Quantity</p>
                <p className="text-white font-semibold">{selectedSaleItem?.quantity || "-"}</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-2xl p-4">
                <p className="text-sm text-gray-400">Customer</p>
                <p className="text-white font-semibold">{selectedSale?.customer?.name || "Walk-in"}</p>
              </div>
            </div>
          </div>

          {form.returnType === "exchange" && (
            <>
              <select
                name="replacementProductId"
                className="px-4 py-3 rounded-xl bg-white"
                value={form.replacementProductId}
                onChange={handleChange}
                required
              >
                <option value="">Select Replacement Product</option>
                {availableReplacement.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName} - Qty {product.quantity} - Rs. {money(product.salePrice)}
                  </option>
                ))}
              </select>

              <input
                name="replacementQuantity"
                type="number"
                min="1"
                className="px-4 py-3 rounded-xl bg-white"
                placeholder="Replacement Quantity"
                value={form.replacementQuantity}
                onChange={handleChange}
                required
              />
            </>
          )}

          <input
            name="refundAmount"
            type="number"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Refund Amount"
            value={form.refundAmount}
            onChange={handleChange}
          />
          <input
            name="additionalCharge"
            type="number"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Additional Charge"
            value={form.additionalCharge}
            onChange={handleChange}
          />
          <input
            name="reason"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Reason"
            value={form.reason}
            onChange={handleChange}
          />
          <input
            name="notes"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Notes"
            value={form.notes}
            onChange={handleChange}
          />
        </div>

        <button className="mt-5 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
          Process Return / Exchange
        </button>
      </form>

      {loading ? (
        <p className="text-yellow-400">Loading returns...</p>
      ) : (
        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-yellow-500 text-black">
              <tr>
                <th className="p-3 text-left">Invoice</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-left">Returned</th>
                <th className="p-3 text-left">Replacement</th>
                <th className="p-3 text-left">Refund</th>
                <th className="p-3 text-left">Charge</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((item) => (
                <tr key={item.id} className="border-t border-yellow-600/20 text-gray-200">
                  <td className="p-3">{item.sale?.invoiceNo || "-"}</td>
                  <td className="p-3 capitalize">{item.returnType}</td>
                  <td className="p-3">{item.returnedProduct?.productName || "-"}</td>
                  <td className="p-3">{item.quantity}</td>
                  <td className="p-3">{item.replacementProduct?.productName || "-"}</td>
                  <td className="p-3">Rs. {money(item.refundAmount)}</td>
                  <td className="p-3">Rs. {money(item.additionalCharge)}</td>
                  <td className="p-3 capitalize">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Returns;
