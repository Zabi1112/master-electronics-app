import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { downloadPdf, printElement } from "../utils/pdfUtils";
import InvoicePrint from "../components/InvoicePrint";

const money = (v) => Number(v || 0).toLocaleString();

const emptyForm = {
  saleType: "cash",
  customerId: "",
  productId: "",
  quantity: 1,
  salePrice: "",
  cashPrice: "",
  discount: 0,
  paidAmount: "",
  advanceAmount: "",
  installmentMonths: 3,
  installmentStartDate: "",
};

const getMarkup = (months) => {
  if (Number(months) === 3) return 20;
  if (Number(months) === 6) return 30;
  if (Number(months) === 12) return 40;
  return 0;
};

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [salesRes, customersRes, productsRes] = await Promise.all([
        api.get("/sales"),
        api.get("/customers"),
        api.get("/products"),
      ]);

      setSales(salesRes.data || []);
      setCustomers(customersRes.data || []);
      setProducts(
        (productsRes.data || []).filter(
          (p) => p.status === "in_stock" && Number(p.quantity || 0) > 0
        )
      );
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
      const cashTotal =
        Number(form.salePrice || selectedProduct?.salePrice || 0) * qty;

      const finalAmount = cashTotal - discount;

      const paid =
        form.paidAmount === "" ? finalAmount : Number(form.paidAmount || 0);

      return {
        cashTotal,
        markupPercent: 0,
        installmentTotal: 0,
        finalAmount,
        advance: 0,
        paid,
        remaining: finalAmount - paid,
        remainingInstallments: 0,
        monthly: 0,
      };
    }

    const cashTotal =
      Number(form.cashPrice || selectedProduct?.salePrice || 0) * qty;

    const markupPercent = getMarkup(form.installmentMonths);
    const installmentTotal = cashTotal + (cashTotal * markupPercent) / 100;
    const finalAmount = installmentTotal - discount;

    const autoAdvance = finalAmount / Number(form.installmentMonths || 1);

    const advance =
      form.advanceAmount === "" ? autoAdvance : Number(form.advanceAmount || 0);

    const remaining = finalAmount - advance;
    const remainingInstallments = Number(form.installmentMonths || 1) - 1;

    const monthly =
      remainingInstallments > 0 ? remaining / remainingInstallments : 0;

    return {
      cashTotal,
      markupPercent,
      installmentTotal,
      finalAmount,
      advance,
      paid: advance,
      remaining,
      remainingInstallments,
      monthly,
    };
  }, [form, selectedProduct]);

  useEffect(() => {
    if (form.saleType !== "installment") return;
    if (!form.productId) return;

    if (form.advanceAmount === "") {
      setForm((old) => ({
        ...old,
        advanceAmount: calculations.advance
          ? Math.round(calculations.advance)
          : "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productId, form.installmentMonths, form.quantity, form.cashPrice]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "productId") {
      const product = products.find((p) => String(p.id) === String(value));

      setForm((old) => ({
        ...old,
        productId: value,
        salePrice: product?.salePrice || "",
        cashPrice: product?.salePrice || "",
        advanceAmount: old.saleType === "installment" ? "" : old.advanceAmount,
      }));

      return;
    }

    if (name === "installmentMonths") {
      setForm((old) => ({
        ...old,
        installmentMonths: value,
        advanceAmount: "",
      }));
      return;
    }

    if (["quantity", "cashPrice", "discount"].includes(name)) {
      setForm((old) => ({
        ...old,
        [name]: value,
        advanceAmount: old.saleType === "installment" ? "" : old.advanceAmount,
      }));
      return;
    }

    setForm((old) => ({ ...old, [name]: value }));
  };

  const createSale = async (e) => {
    e.preventDefault();
    setError("");

    if (calculations.finalAmount <= 0) {
      setError("Final amount must be greater than zero");
      return;
    }

    if (calculations.remaining < 0) {
      setError("Advance/Paid amount cannot be greater than final amount");
      return;
    }

    try {
      const payload =
        form.saleType === "cash"
          ? {
              saleType: "cash",
              productId: Number(form.productId),
              quantity: Number(form.quantity || 1),
              salePrice: Number(
                form.salePrice || selectedProduct?.salePrice || 0
              ),
              discount: Number(form.discount || 0),
              paidAmount:
                form.paidAmount === ""
                  ? Number(calculations.finalAmount)
                  : Number(form.paidAmount || 0),
            }
          : {
              saleType: "installment",
              customerId: Number(form.customerId),
              productId: Number(form.productId),
              quantity: Number(form.quantity || 1),
              cashPrice: Number(
                form.cashPrice || selectedProduct?.salePrice || 0
              ),
              discount: Number(form.discount || 0),
              advanceAmount: Number(calculations.advance || 0),
              installmentMonths: Number(form.installmentMonths || 3),
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
              onChange={(e) =>
                setForm({
                  ...emptyForm,
                  saleType: e.target.value,
                  installmentMonths: 3,
                })
              }
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
                <option value="">Select Installment Customer</option>
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
                  {p.productName} - Qty {p.quantity} - Rs. {money(p.salePrice)}
                </option>
              ))}
            </select>

            <input
              name="quantity"
              type="number"
              min="1"
              max={selectedProduct?.quantity || ""}
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
                  required
                />

                <select
                  name="installmentMonths"
                  className="px-4 py-3 rounded-xl bg-white"
                  value={form.installmentMonths}
                  onChange={handleChange}
                  required
                >
                  <option value="3">3 Months - 20% Increase</option>
                  <option value="6">6 Months - 30% Increase</option>
                  <option value="12">12 Months - 40% Increase</option>
                </select>

                <input
                  name="advanceAmount"
                  type="number"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Advance / First Installment"
                  value={form.advanceAmount}
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

          {form.saleType === "installment" && (
            <div className="mt-5 bg-yellow-500/10 border border-yellow-600/30 rounded-2xl p-4">
              <h3 className="text-yellow-400 font-bold mb-3">
                Installment Price Calculation
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Calc
                  title="Cash Total"
                  value={`Rs. ${money(calculations.cashTotal)}`}
                />
                <Calc title="Markup" value={`${calculations.markupPercent}%`} />
                <Calc
                  title="Installment Price"
                  value={`Rs. ${money(calculations.installmentTotal)}`}
                />
                <Calc
                  title="Advance / 1st Installment"
                  value={`Rs. ${money(calculations.advance)}`}
                />
                <Calc
                  title="Remaining"
                  value={`Rs. ${money(calculations.remaining)}`}
                />
                <Calc
                  title="Remaining Installments"
                  value={calculations.remainingInstallments}
                />
                <Calc
                  title="Monthly Installment"
                  value={`Rs. ${money(calculations.monthly)}`}
                />
                <Calc
                  title="Final Amount"
                  value={`Rs. ${money(calculations.finalAmount)}`}
                />
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Advance amount is counted as installment #1. Remaining
                installments will start from the next month on the 10th.
              </p>
            </div>
          )}

          {form.saleType === "cash" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              <CalcBox title="Final Amount" value={calculations.finalAmount} />
              <CalcBox title="Paid" value={calculations.paid} green />
              <CalcBox title="Remaining" value={calculations.remaining} red />
            </div>
          )}

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
                  <th className="p-3 text-right">Invoice</th>
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
                    <td className="p-3">
                      {sale.product?.productName || sale.productId}
                    </td>
                    <td className="p-3">Rs. {money(sale.finalAmount)}</td>
                    <td className="p-3">Rs. {money(sale.paidAmount)}</td>
                    <td className="p-3">Rs. {money(sale.remainingAmount)}</td>
                    <td className="p-3 capitalize">{sale.status}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedInvoice(sale)}
                        className="bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold"
                      >
                        View
                      </button>
                    </td>
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
                  <Info label="Customer" value={sale.customer?.name || "-"} />
                  <Info label="Status" value={sale.status} />
                  <Info label="Final" value={`Rs. ${money(sale.finalAmount)}`} />
                  <Info label="Paid" value={`Rs. ${money(sale.paidAmount)}`} />
                  <Info
                    label="Remaining"
                    value={`Rs. ${money(sale.remainingAmount)}`}
                  />
                  <Info label="Profit" value={`Rs. ${money(sale.profit)}`} />
                </div>

                <button
                  onClick={() => setSelectedInvoice(sale)}
                  className="mt-4 w-full bg-yellow-500 text-black py-3 rounded-xl font-bold"
                >
                  View Invoice
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-yellow-400">
                Invoice {selectedInvoice.invoiceNo}
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    printElement(`invoice-print-${selectedInvoice.id}`)
                  }
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Print
                </button>

                <button
                  onClick={() =>
                    downloadPdf(
                      `invoice-print-${selectedInvoice.id}`,
                      `${selectedInvoice.invoiceNo}.pdf`
                    )
                  }
                  className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                >
                  PDF
                </button>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            <InvoicePrint sale={selectedInvoice} />
          </div>
        </div>
      )}
    </div>
  );
};

const Calc = ({ title, value }) => (
  <div className="bg-black/60 border border-yellow-600/20 rounded-xl p-3">
    <p className="text-gray-500 text-xs">{title}</p>
    <h3 className="text-yellow-300 font-bold">{value}</h3>
  </div>
);

const CalcBox = ({ title, value, green, red }) => (
  <div
    className={`border rounded-xl p-4 ${
      green
        ? "bg-green-500/10 border-green-600/30"
        : red
        ? "bg-red-500/10 border-red-600/30"
        : "bg-yellow-500/10 border-yellow-600/30"
    }`}
  >
    <p className="text-gray-400 text-sm">{title}</p>
    <h3
      className={`text-xl font-bold ${
        green ? "text-green-300" : red ? "text-red-300" : "text-yellow-400"
      }`}
    >
      Rs. {money(value)}
    </h3>
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold capitalize">{value}</p>
  </div>
);

export default Sales;