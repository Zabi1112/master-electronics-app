import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const emptyForm = {
  saleType: "cash",
  customerId: "",
  productId: "",
  quantity: 1,

  salePrice: "",
  cashPrice: "",
  installmentPrice: "",

  discount: 0,
  paidAmount: "",
  advanceAmount: "",

  installmentMonths: 6,
  installmentStartDate: "",
};

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, customersRes, productsRes] = await Promise.all([
        api.get("/sales"),
        api.get("/customers"),
        api.get("/products"),
      ]);

      setSales(salesRes.data);
      setCustomers(customersRes.data);
      setProducts(productsRes.data.filter((p) => p.status === "in_stock" && Number(p.quantity) > 0));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load sales data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((p) => String(p.id) === String(form.productId));
  }, [products, form.productId]);

  const calculations = useMemo(() => {
    const qty = Number(form.quantity || 1);
    const discount = Number(form.discount || 0);

    if (form.saleType === "cash") {
      const price = Number(form.salePrice || form.cashPrice || 0) * qty;
      const finalAmount = price - discount;
      return {
        finalAmount,
        paid: Number(form.paidAmount || finalAmount),
        remaining: finalAmount - Number(form.paidAmount || finalAmount),
      };
    }

    const installmentPrice = Number(form.installmentPrice || 0) * qty;
    const finalAmount = installmentPrice - discount;
    const advance = Number(form.advanceAmount || 0);
    const remaining = finalAmount - advance;
    const monthly = remaining / Number(form.installmentMonths || 1);

    return {
      finalAmount,
      paid: advance,
      remaining,
      monthly,
    };
  }, [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "productId") {
      const product = products.find((p) => String(p.id) === String(value));

      setForm((old) => ({
        ...old,
        productId: value,
        salePrice: product?.salePrice || "",
        cashPrice: product?.salePrice || "",
      }));

      return;
    }

    setForm((old) => ({ ...old, [name]: value }));
  };

  const createSale = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload =
        form.saleType === "cash"
          ? {
              saleType: "cash",
              productId: Number(form.productId),
              quantity: Number(form.quantity || 1),
              salePrice: Number(form.salePrice || form.cashPrice || 0),
              discount: Number(form.discount || 0),
              paidAmount: Number(form.paidAmount || calculations.finalAmount),
            }
          : {
              saleType: "installment",
              customerId: Number(form.customerId),
              productId: Number(form.productId),
              quantity: Number(form.quantity || 1),
              cashPrice: Number(form.cashPrice || selectedProduct?.salePrice || 0),
              installmentPrice: Number(form.installmentPrice || 0),
              discount: Number(form.discount || 0),
              advanceAmount: Number(form.advanceAmount || 0),
              installmentMonths: Number(form.installmentMonths || 1),
              installmentStartDate:
                form.installmentStartDate ||
                new Date().toISOString().split("T")[0],
            };

      await api.post("/sales", payload);
      setForm(emptyForm);
      setFormOpen(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Create sale failed");
    }
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Sales
          </h1>
          <p className="text-gray-400 text-sm">
            Create cash sales and installment sales.
          </p>
        </div>

        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ New Sale"}
        </button>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={createSale}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Create Sale
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <select
              name="saleType"
              className="px-4 py-3 rounded-xl bg-white"
              value={form.saleType}
              onChange={(e) => setForm({ ...emptyForm, saleType: e.target.value })}
            >
              <option value="cash">Cash Sale</option>
              <option value="installment">Installment Sale</option>
            </select>

            {form.saleType === "installment" && (
              <select
                name="customerId"
                className="px-4 py-3 rounded-xl bg-white"
                value={form.customerId}
                onChange={handleChange}
                required
              >
                <option value="">Select Customer</option>
                {customers
                  .filter((c) => c.customerType === "installment")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </option>
                  ))}
              </select>
            )}

            <select
              name="productId"
              className="px-4 py-3 rounded-xl bg-white"
              value={form.productId}
              onChange={handleChange}
              required
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productName} - Qty {p.quantity} - {Number(p.salePrice || 0).toLocaleString()}
                </option>
              ))}
            </select>

            <input
              name="quantity"
              type="number"
              min="1"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Quantity"
              value={form.quantity}
              onChange={handleChange}
              required
            />

            {form.saleType === "cash" && (
              <>
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
                  name="paidAmount"
                  type="number"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Paid Amount"
                  value={form.paidAmount}
                  onChange={handleChange}
                />
              </>
            )}

            {form.saleType === "installment" && (
              <>
                <input
                  name="cashPrice"
                  type="number"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Cash Price"
                  value={form.cashPrice}
                  onChange={handleChange}
                />

                <input
                  name="installmentPrice"
                  type="number"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Installment Total Price"
                  value={form.installmentPrice}
                  onChange={handleChange}
                  required
                />

                <input
                  name="advanceAmount"
                  type="number"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Advance Amount"
                  value={form.advanceAmount}
                  onChange={handleChange}
                  required
                />

                <input
                  name="installmentMonths"
                  type="number"
                  min="1"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Installment Months"
                  value={form.installmentMonths}
                  onChange={handleChange}
                  required
                />

                <input
                  name="installmentStartDate"
                  type="date"
                  className="px-4 py-3 rounded-xl bg-white"
                  value={form.installmentStartDate}
                  onChange={handleChange}
                />
              </>
            )}

            <input
              name="discount"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Discount"
              value={form.discount}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            <div className="bg-yellow-500/10 border border-yellow-600/30 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Final Amount</p>
              <h3 className="text-xl font-bold text-yellow-400">
                {Number(calculations.finalAmount || 0).toLocaleString()}
              </h3>
            </div>

            <div className="bg-green-500/10 border border-green-600/30 rounded-xl p-4">
              <p className="text-gray-400 text-sm">
                {form.saleType === "cash" ? "Paid" : "Advance"}
              </p>
              <h3 className="text-xl font-bold text-green-300">
                {Number(calculations.paid || 0).toLocaleString()}
              </h3>
            </div>

            <div className="bg-red-500/10 border border-red-600/30 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Remaining</p>
              <h3 className="text-xl font-bold text-red-300">
                {Number(calculations.remaining || 0).toLocaleString()}
              </h3>
            </div>

            {form.saleType === "installment" && (
              <div className="bg-black/60 border border-yellow-600/30 rounded-xl p-4 md:col-span-3">
                <p className="text-gray-400 text-sm">Monthly Installment</p>
                <h3 className="text-2xl font-bold text-yellow-400">
                  {Number(calculations.monthly || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Due date will be generated on 10th of every month.
                </p>
              </div>
            )}
          </div>

          <button className="mt-5 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Save Sale
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading sales...</p>
      ) : (
        <>
          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Invoice</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Final</th>
                  <th className="p-3 text-left">Paid</th>
                  <th className="p-3 text-left">Remaining</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>

              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">{sale.invoiceNo}</td>
                    <td className="p-3 capitalize">{sale.saleType}</td>
                    <td className="p-3">{sale.customer?.name || "-"}</td>
                    <td className="p-3">{sale.product?.productName || sale.productId}</td>
                    <td className="p-3">{Number(sale.finalAmount || 0).toLocaleString()}</td>
                    <td className="p-3">{Number(sale.paidAmount || 0).toLocaleString()}</td>
                    <td className="p-3">{Number(sale.remainingAmount || 0).toLocaleString()}</td>
                    <td className="p-3 capitalize">{sale.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">
                      {sale.invoiceNo}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {sale.product?.productName || `Product #${sale.productId}`}
                    </p>
                  </div>

                  <span className="h-fit px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs capitalize">
                    {sale.saleType}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Customer</p>
                    <p>{sale.customer?.name || "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="capitalize">{sale.status}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Final</p>
                    <p>{Number(sale.finalAmount || 0).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Paid</p>
                    <p>{Number(sale.paidAmount || 0).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Remaining</p>
                    <p>{Number(sale.remainingAmount || 0).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Profit</p>
                    <p>{Number(sale.profit || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Sales;