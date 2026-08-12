import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { downloadPdf, printElement } from "../utils/pdfUtils";
import InvoicePrint from "../components/InvoicePrint";

const money = (v) => Number(v || 0).toLocaleString();

const emptyForm = {
  saleType: "cash",
  customerId: "",
  items: [], // { productId, quantity, salePrice, cashPrice }
  discount: 0,
  paidAmount: "",
  advanceAmount: "",
  installmentFrequency: "monthly",
  installmentMonths: 3,
  markupPercent: "",
  installmentStartDate: "",
};

const emptyItemPicker = { productId: "", quantity: 1 };

const getMarkup = (months) => {
  if (Number(months) === 3) return 20;
  if (Number(months) === 6) return 30;
  if (Number(months) === 12) return 40;
  return 0;
};

// A sale's items (potentially multiple) collapsed into one display label,
// e.g. "iPhone 13" or "iPhone 13 +2 more".
const productLabel = (sale) => {
  const items = sale.items || [];
  if (items.length === 0) return sale.productId ? `Product #${sale.productId}` : "-";
  const first = items[0]?.product?.productName || "Product";
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
};

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchMode, setSearchMode] = useState("name"); // "name" | "item"
  const [searchText, setSearchText] = useState("");
  const [saleTypeFilter, setSaleTypeFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [itemPicker, setItemPicker] = useState(emptyItemPicker);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

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

  const filteredSales = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesType = !saleTypeFilter || sale.saleType === saleTypeFilter;

      if (!matchesType) return false;
      if (!text) return true;

      const haystack =
        searchMode === "name"
          ? sale.customer?.name || ""
          : (sale.items || []).map((i) => i.product?.productName || "").join(" ");

      return haystack.toLowerCase().includes(text);
    });
  }, [sales, searchMode, searchText, saleTypeFilter]);

  const calculations = useMemo(() => {
    const discount = Number(form.discount || 0);

    const cashTotal = form.items.reduce((sum, item) => {
      const product = products.find((p) => String(p.id) === String(item.productId));
      const unit = Number(
        (form.saleType === "cash" ? item.salePrice : item.cashPrice) ||
          product?.salePrice ||
          0
      );
      return sum + unit * Number(item.quantity || 1);
    }, 0);

    if (form.saleType === "cash") {
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

    const markupPercent =
      form.installmentFrequency === "monthly"
        ? getMarkup(form.installmentMonths)
        : Number(form.markupPercent || 0);
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
  }, [form, products]);

  useEffect(() => {
    if (form.saleType !== "installment") return;
    if (form.items.length === 0) return;

    if (form.advanceAmount === "") {
      setForm((old) => ({
        ...old,
        advanceAmount: calculations.advance
          ? Math.round(calculations.advance)
          : "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.items,
    form.installmentMonths,
    form.installmentFrequency,
    form.markupPercent,
  ]);

  const addItemToCart = () => {
    if (!itemPicker.productId) return;

    const product = products.find(
      (p) => String(p.id) === String(itemPicker.productId)
    );
    if (!product) return;

    const qty = Number(itemPicker.quantity || 1);

    setForm((old) => {
      const existingIndex = old.items.findIndex(
        (item) => String(item.productId) === String(itemPicker.productId)
      );

      let items;
      if (existingIndex >= 0) {
        items = [...old.items];
        items[existingIndex] = {
          ...items[existingIndex],
          quantity: Number(items[existingIndex].quantity || 0) + qty,
        };
      } else {
        items = [
          ...old.items,
          {
            productId: itemPicker.productId,
            quantity: qty,
            salePrice: product.salePrice || "",
            cashPrice: product.salePrice || "",
          },
        ];
      }

      return {
        ...old,
        items,
        advanceAmount: old.saleType === "installment" ? "" : old.advanceAmount,
      };
    });

    setItemPicker(emptyItemPicker);
  };

  const removeItem = (index) => {
    setForm((old) => ({
      ...old,
      items: old.items.filter((_, i) => i !== index),
      advanceAmount: old.saleType === "installment" ? "" : old.advanceAmount,
    }));
  };

  const updateItemField = (index, field, value) => {
    setForm((old) => {
      const items = [...old.items];
      items[index] = { ...items[index], [field]: value };
      return {
        ...old,
        items,
        advanceAmount: old.saleType === "installment" ? "" : old.advanceAmount,
      };
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "installmentMonths") {
      setForm((old) => ({
        ...old,
        installmentMonths: value,
        advanceAmount: "",
      }));
      return;
    }

    if (name === "installmentFrequency") {
      setForm((old) => ({
        ...old,
        installmentFrequency: value,
        installmentMonths: value === "monthly" ? 3 : old.installmentMonths || 2,
        markupPercent: value === "monthly" ? "" : old.markupPercent,
        advanceAmount: "",
      }));
      return;
    }

    if (["discount", "markupPercent"].includes(name)) {
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

    if (form.items.length === 0) {
      setError("Add at least one item to the sale");
      return;
    }

    if (calculations.finalAmount <= 0) {
      setError("Final amount must be greater than zero");
      return;
    }

    if (calculations.remaining < 0) {
      setError("Advance/Paid amount cannot be greater than final amount");
      return;
    }

    try {
      const itemsPayload = form.items.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity || 1),
        ...(form.saleType === "cash"
          ? { salePrice: Number(item.salePrice || 0) }
          : { cashPrice: Number(item.cashPrice || 0) }),
      }));

      const payload =
        form.saleType === "cash"
          ? {
              saleType: "cash",
              items: itemsPayload,
              discount: Number(form.discount || 0),
              paidAmount:
                form.paidAmount === ""
                  ? Number(calculations.finalAmount)
                  : Number(form.paidAmount || 0),
            }
          : {
              saleType: "installment",
              customerId: Number(form.customerId),
              items: itemsPayload,
              discount: Number(form.discount || 0),
              advanceAmount: Number(calculations.advance || 0),
              installmentFrequency: form.installmentFrequency || "monthly",
              installmentMonths: Number(form.installmentMonths || 3),
              markupPercent:
                form.installmentFrequency === "monthly"
                  ? undefined
                  : Number(form.markupPercent || 0),
              installmentStartDate:
                form.installmentStartDate ||
                new Date().toISOString().split("T")[0],
            };

      await api.post("/sales", payload);

      setForm(emptyForm);
      setItemPicker(emptyItemPicker);
      setFormOpen(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Create sale failed");
    }
  };

  const openPayment = (sale) => {
    setPaymentModal(sale);
    setPaymentAmount(sale.remainingAmount || "");
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (submittingPayment) return;

    setError("");
    setSubmittingPayment(true);

    try {
      await api.put(`/sales/${paymentModal.id}/pay`, {
        amount: Number(paymentAmount || 0),
      });

      setPaymentModal(null);
      setPaymentAmount("");
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed");
    } finally {
      setSubmittingPayment(false);
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

            {form.saleType === "cash" && (
              <input
                name="paidAmount"
                type="number"
                className="px-4 py-3 rounded-xl bg-white"
                placeholder="Paid Amount"
                value={form.paidAmount}
                onChange={handleChange}
              />
            )}

            {form.saleType === "installment" && (
              <>
                <select
                  name="installmentFrequency"
                  className="px-4 py-3 rounded-xl bg-white"
                  value={form.installmentFrequency}
                  onChange={handleChange}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>

                {form.installmentFrequency === "monthly" ? (
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
                ) : (
                  <>
                    <input
                      name="installmentMonths"
                      type="number"
                      min="2"
                      className="px-4 py-3 rounded-xl bg-white"
                      placeholder={`Number of ${form.installmentFrequency} installments`}
                      value={form.installmentMonths}
                      onChange={handleChange}
                      required
                    />

                    <input
                      name="markupPercent"
                      type="number"
                      min="0"
                      className="px-4 py-3 rounded-xl bg-white"
                      placeholder="Markup %"
                      value={form.markupPercent}
                      onChange={handleChange}
                      required
                    />
                  </>
                )}

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

          <div className="mt-5">
            <h3 className="text-yellow-400 font-bold mb-3">Items</h3>

            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <select
                className="px-4 py-3 rounded-xl bg-white flex-1"
                value={itemPicker.productId}
                onChange={(e) =>
                  setItemPicker({ ...itemPicker, productId: e.target.value })
                }
              >
                <option value="">Select Product to Add</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productName} - Qty {p.quantity} - Rs. {money(p.salePrice)}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                className="px-4 py-3 rounded-xl bg-white w-full md:w-32"
                placeholder="Qty"
                value={itemPicker.quantity}
                onChange={(e) =>
                  setItemPicker({ ...itemPicker, quantity: e.target.value })
                }
              />

              <button
                type="button"
                onClick={addItemToCart}
                disabled={!itemPicker.productId}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-3 rounded-xl disabled:opacity-50"
              >
                + Add Item
              </button>
            </div>

            {form.items.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No items added yet — add at least one to create the sale.
              </p>
            ) : (
              <div className="space-y-3">
                {form.items.map((item, index) => {
                  const product = products.find(
                    (p) => String(p.id) === String(item.productId)
                  );

                  return (
                    <div
                      key={item.productId}
                      className="bg-black/60 border border-yellow-600/20 rounded-xl p-3 grid grid-cols-2 md:grid-cols-5 gap-3 items-center"
                    >
                      <div className="col-span-2">
                        <p className="text-white font-semibold">
                          {product?.productName || `Product #${item.productId}`}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Stock: {product?.quantity ?? "-"}
                        </p>
                      </div>

                      <input
                        type="number"
                        min="1"
                        className="px-3 py-2 rounded-lg bg-white"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemField(index, "quantity", e.target.value)
                        }
                      />

                      <input
                        type="number"
                        className="px-3 py-2 rounded-lg bg-white"
                        placeholder={
                          form.saleType === "cash" ? "Sale Price" : "Cash Price"
                        }
                        value={
                          form.saleType === "cash"
                            ? item.salePrice
                            : item.cashPrice
                        }
                        onChange={(e) =>
                          updateItemField(
                            index,
                            form.saleType === "cash" ? "salePrice" : "cashPrice",
                            e.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="bg-red-600/80 hover:bg-red-500 text-white font-bold px-3 py-2 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
                  title={`Per-${form.installmentFrequency === "monthly" ? "Month" : form.installmentFrequency === "weekly" ? "Week" : "Day"} Installment`}
                  value={`Rs. ${money(calculations.monthly)}`}
                />
                <Calc
                  title="Final Amount"
                  value={`Rs. ${money(calculations.finalAmount)}`}
                />
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Advance amount is counted as installment #1. Remaining
                installments will follow{" "}
                {form.installmentFrequency === "monthly"
                  ? "every month on the 10th"
                  : form.installmentFrequency === "weekly"
                  ? "every 7 days from the start date"
                  : "every day from the start date"}
                .
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

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex gap-2 bg-black/60 border border-yellow-600/30 rounded-xl p-1 w-fit">
            {[
              { key: "name", label: "Name" },
              { key: "item", label: "Item" },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setSearchMode(mode.key)}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  searchMode === mode.key
                    ? "bg-yellow-500 text-black"
                    : "text-yellow-300"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="flex-1 px-4 py-3 rounded-xl bg-white"
            placeholder={
              searchMode === "name"
                ? "Search by customer name..."
                : "Search by item / product name..."
            }
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={saleTypeFilter}
            onChange={(e) => setSaleTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="cash">Cash</option>
            <option value="installment">Installment</option>
          </select>

          {(searchText || saleTypeFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setSaleTypeFilter("");
              }}
              className="bg-gray-700 text-white font-bold px-5 py-3 rounded-xl"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-yellow-400">Loading sales...</p>
      ) : filteredSales.length === 0 ? (
        <p className="text-gray-400">No sales match your search.</p>
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
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">{sale.invoiceNo}</td>
                    <td className="p-3 capitalize">{sale.saleType}</td>
                    <td className="p-3">{sale.customer?.name || "-"}</td>
                    <td className="p-3">{productLabel(sale)}</td>
                    <td className="p-3">Rs. {money(sale.finalAmount)}</td>
                    <td className="p-3">Rs. {money(sale.paidAmount)}</td>
                    <td className="p-3">Rs. {money(sale.remainingAmount)}</td>
                    <td className="p-3 capitalize">{sale.status}</td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      {sale.saleType === "cash" &&
                        Number(sale.remainingAmount) > 0 && (
                          <button
                            onClick={() => openPayment(sale)}
                            className="bg-green-500 text-black px-3 py-2 rounded-lg font-bold"
                          >
                            Record Payment
                          </button>
                        )}
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
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">
                      {sale.invoiceNo}
                    </h3>
                    <p className="text-sm text-gray-400">{productLabel(sale)}</p>
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

                {sale.saleType === "cash" && Number(sale.remainingAmount) > 0 && (
                  <button
                    onClick={() => openPayment(sale)}
                    className="mt-3 w-full bg-green-500 text-black py-3 rounded-xl font-bold"
                  >
                    Record Payment
                  </button>
                )}

                <button
                  onClick={() => setSelectedInvoice(sale)}
                  className="mt-3 w-full bg-yellow-500 text-black py-3 rounded-xl font-bold"
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

      {paymentModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <form
            onSubmit={submitPayment}
            className="w-full max-w-md bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5"
          >
            <h2 className="text-xl font-bold text-yellow-400 mb-1">
              Record Payment
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Invoice {paymentModal.invoiceNo} — {productLabel(paymentModal)}
            </p>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <Info label="Paid so far" value={`Rs. ${money(paymentModal.paidAmount)}`} />
              <Info label="Remaining" value={`Rs. ${money(paymentModal.remainingAmount)}`} />
            </div>

            <label className="text-sm text-gray-400 mb-1 block">Amount Received</label>
            <input
              type="number"
              min="1"
              max={paymentModal.remainingAmount}
              className="w-full px-4 py-3 rounded-xl bg-white"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="bg-gray-700 text-white py-3 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="bg-green-500 text-black py-3 rounded-xl font-bold disabled:opacity-60"
              >
                {submittingPayment ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </form>
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