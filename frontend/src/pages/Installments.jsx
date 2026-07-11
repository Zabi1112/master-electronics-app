import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/api";
import { useAuth } from "../context/AuthContext.jsx";
import { downloadPdf, printElement } from "../utils/pdfUtils";
import InstallmentReceiptPrint from "../components/InstallmentReceiptPrint.jsx";
import DueThisMonthPrint from "../components/DueThisMonthPrint.jsx";

const money = (v) => Number(v || 0).toLocaleString();

const monthLabel = (key) => {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const Installments = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [view, setView] = useState("customers"); // "customers" | "collections"

  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [installments, setInstallments] = useState([]);

  const [collections, setCollections] = useState(null);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const [dueModalOpen, setDueModalOpen] = useState(false);
  const [dueThisMonth, setDueThisMonth] = useState(null);
  const [dueLoading, setDueLoading] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    fineDiscount: 0,
    notes: "",
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);

  const [correctionModal, setCorrectionModal] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    paidAmount: "",
    finePaid: "",
    fineDiscount: "",
    paidDate: "",
    reason: "",
  });
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [notice, setNotice] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/installments/customers");
      setCustomers(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerItems = async (customer) => {
    setSelectedCustomer(customer);
    setSelectedSale(null);
    setInstallments([]);
    setError("");

    try {
      const res = await api.get(`/installments/customer/${customer.id}`);
      setSales(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customer items");
    }
  };

  const loadSaleInstallments = async (sale) => {
    setSelectedSale(sale);
    setError("");

    try {
      const res = await api.get(`/installments/sale/${sale.id}`);
      setInstallments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load installments");
    }
  };

  const loadMonthlyCollections = async () => {
    setCollectionsLoading(true);
    setError("");

    try {
      const res = await api.get("/installments/monthly-collections");
      setCollections(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load monthly collections"
      );
    } finally {
      setCollectionsLoading(false);
    }
  };

  const loadDueThisMonth = async () => {
    setDueLoading(true);
    setError("");

    try {
      const res = await api.get("/installments/due-this-month");
      setDueThisMonth(res.data);
      setDueModalOpen(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load this month's due list"
      );
    } finally {
      setDueLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (view === "collections" && !collections) {
      loadMonthlyCollections();
    }
  }, [view]);

  const summary = useMemo(() => {
    return installments.reduce(
      (acc, i) => {
        acc.total += Number(i.amount || 0);
        acc.paid += Number(i.paidAmount || 0);
        acc.remaining += Number(i.remainingAmount || 0);
        acc.fine += Number(i.liveFineAmount || 0);
        acc.payable += Number(i.liveTotalPayable || 0);
        return acc;
      },
      { total: 0, paid: 0, remaining: 0, fine: 0, payable: 0 }
    );
  }, [installments]);

  const openPayment = (item) => {
    setPaymentModal(item);
    setPaymentForm({
      amount: item.liveTotalPayable || item.remainingAmount || "",
      fineDiscount: 0,
      notes: "",
    });
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (submittingPayment) return;

    setError("");
    setSubmittingPayment(true);

    try {
      const res = await api.put(`/installments/${paymentModal.id}/pay`, {
        amount: Number(paymentForm.amount || 0),
        fineDiscount: Number(paymentForm.fineDiscount || 0),
        notes: paymentForm.notes,
      });

      const paidInstallment = res.data.installment;

      setLastPayment({
        totalPaid:
          Number(res.data.installmentPaid || 0) +
          Number(res.data.finePaid || 0),
        installmentPaid: res.data.installmentPaid,
        finePaid: res.data.finePaid,
        excessAmount: res.data.excessAmount,
        reamortized: res.data.reamortized,
        futureCount: res.data.updatedFutureInstallments?.length || 0,
      });

      setPaymentModal(null);

      if (selectedSale) {
        await loadSaleInstallments(selectedSale);
        await loadCustomerItems(selectedCustomer);
      }

      setSelectedReceipt(paidInstallment);
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openCorrection = (item) => {
    setCorrectionModal(item);
    setCorrectionForm({
      paidAmount: item.paidAmount ?? "",
      finePaid: item.finePaid ?? "",
      fineDiscount: item.fineDiscount ?? "",
      paidDate: item.paidDate || "",
      reason: "",
    });
  };

  const submitCorrection = async (e) => {
    e.preventDefault();
    if (submittingCorrection) return;

    setError("");
    setNotice("");
    setSubmittingCorrection(true);

    try {
      const res = await api.put(`/installments/${correctionModal.id}/correct`, {
        paidAmount: Number(correctionForm.paidAmount || 0),
        finePaid: Number(correctionForm.finePaid || 0),
        fineDiscount: Number(correctionForm.fineDiscount || 0),
        paidDate: correctionForm.paidDate || null,
        reason: correctionForm.reason,
      });

      setCorrectionModal(null);
      setNotice(res.data.warning || "Payment corrected successfully.");

      if (selectedSale) {
        await loadSaleInstallments(selectedSale);
        await loadCustomerItems(selectedCustomer);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Correction failed");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const resetSelection = () => {
    setSelectedCustomer(null);
    setSelectedSale(null);
    setSales([]);
    setInstallments([]);
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Installments
          </h1>
          <p className="text-gray-400 text-sm">
            Select customer, item, then receive payments and print receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view === "customers" && (selectedCustomer || selectedSale) ? (
            <button
              onClick={resetSelection}
              className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl"
            >
              Back to Customers
            </button>
          ) : (
            <div className="flex gap-2 bg-black/60 border border-yellow-600/30 rounded-xl p-1 w-fit">
              <button
                onClick={() => setView("customers")}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  view === "customers"
                    ? "bg-yellow-500 text-black"
                    : "text-yellow-300"
                }`}
              >
                Customers
              </button>
              <button
                onClick={() => setView("collections")}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${
                  view === "collections"
                    ? "bg-yellow-500 text-black"
                    : "text-yellow-300"
                }`}
              >
                Monthly Collections
              </button>
            </div>
          )}

          <button
            onClick={loadDueThisMonth}
            disabled={dueLoading}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-3 rounded-xl disabled:opacity-50"
          >
            {dueLoading ? "Loading..." : "This Month's Due List"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {notice && (
        <div className="bg-yellow-600/20 border border-yellow-500/40 text-yellow-300 rounded-xl p-3 mb-4 flex justify-between items-start gap-3">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="text-yellow-400 font-bold shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {view === "customers" && (
      <>
      {!selectedCustomer && (
        <>
          <h2 className="text-xl font-bold text-white mb-4">
            Installment Customers
          </h2>

          {loading ? (
            <p className="text-yellow-400">Loading customers...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => loadCustomerItems(customer)}
                  className="text-left bg-black/75 border border-yellow-600/30 hover:border-yellow-400 rounded-2xl p-5 transition"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-yellow-400">
                        {customer.name}
                      </h3>
                      <p className="text-gray-400 text-sm">{customer.phone}</p>
                    </div>

                    <span className="h-fit px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs">
                      Installment
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <Info label="CNIC" value={customer.cnic || "-"} />
                    <Info label="Risk" value={customer.riskStatus || "-"} />
                    <Info label="Cheque" value={customer.chequeNumber || "-"} />
                    <Info label="Father" value={customer.fatherName || "-"} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedCustomer && !selectedSale && (
        <>
          <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 mb-5">
            <h2 className="text-xl font-bold text-yellow-400">
              {selectedCustomer.name}
            </h2>
            <p className="text-gray-400 text-sm">
              {selectedCustomer.phone} | CNIC: {selectedCustomer.cnic || "-"}
            </p>
          </div>

          <h2 className="text-xl font-bold text-white mb-4">
            Installment Items
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sales.map((sale) => (
              <button
                key={sale.id}
                onClick={() => loadSaleInstallments(sale)}
                className="text-left bg-black/75 border border-yellow-600/30 hover:border-yellow-400 rounded-2xl p-5 transition"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-yellow-400">
                      {sale.product?.productName || `Product #${sale.productId}`}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Invoice: {sale.invoiceNo}
                    </p>
                  </div>

                  <span
                    className={`h-fit px-3 py-1 rounded-full text-xs ${sale.status === "cleared"
                        ? "bg-green-600/20 text-green-300"
                        : "bg-blue-600/20 text-blue-300"
                      }`}
                  >
                    {sale.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <Info label="Total" value={`Rs. ${money(sale.finalAmount)}`} />
                  <Info label="Paid" value={`Rs. ${money(sale.paidAmount)}`} />
                  <Info
                    label="Remaining"
                    value={`Rs. ${money(sale.remainingAmount)}`}
                  />
                  <Info
                    label="Monthly"
                    value={`Rs. ${money(sale.monthlyInstallment)}`}
                  />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedSale && (
        <>
          <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 mb-5">
            <button
              onClick={() => {
                setSelectedSale(null);
                setInstallments([]);
              }}
              className="text-yellow-400 text-sm mb-3"
            >
              ← Back to Items
            </button>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-yellow-400">
                  {selectedSale.product?.productName ||
                    `Product #${selectedSale.productId}`}
                </h2>
                <p className="text-gray-400 text-sm">
                  Invoice: {selectedSale.invoiceNo} | Status:{" "}
                  {selectedSale.status}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini title="Total" value={`Rs. ${money(selectedSale.finalAmount)}`} />
                <Mini title="Paid" value={`Rs. ${money(selectedSale.paidAmount)}`} />
                <Mini
                  title="Remaining"
                  value={`Rs. ${money(selectedSale.remainingAmount)}`}
                />
                <Mini
                  title="Monthly"
                  value={`Rs. ${money(selectedSale.monthlyInstallment)}`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <Mini title="Schedule Total" value={`Rs. ${money(summary.total)}`} />
            <Mini title="Paid" value={`Rs. ${money(summary.paid)}`} />
            <Mini title="Remaining" value={`Rs. ${money(summary.remaining)}`} />
            <Mini title="Live Fine" value={`Rs. ${money(summary.fine)}`} />
            <Mini title="Payable" value={`Rs. ${money(summary.payable)}`} />
          </div>

          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">No</th>
                  <th className="p-3 text-left">Due Date</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Paid</th>
                  <th className="p-3 text-left">Remaining</th>
                  <th className="p-3 text-left">Late</th>
                  <th className="p-3 text-left">Fine</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {installments.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">#{item.installmentNo}</td>
                    <td className="p-3">{item.dueDate}</td>
                    <td className="p-3">Rs. {money(item.amount)}</td>
                    <td className="p-3">Rs. {money(item.paidAmount)}</td>
                    <td className="p-3">Rs. {money(item.remainingAmount)}</td>
                    <td className="p-3">{item.liveLateDays || 0} days</td>
                    <td className="p-3 text-orange-300">
                      Rs. {money(item.liveFineAmount)}
                    </td>
                    <td className="p-3">
                      <Badge status={item.status} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {item.status !== "paid" ? (
                          <button
                            onClick={() => openPayment(item)}
                            className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold"
                          >
                            Pay
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setLastPayment(null);
                              setSelectedReceipt(item);
                            }}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold"
                          >
                            Receipt
                          </button>
                        )}

                        {isAdmin && Number(item.paidAmount || 0) > 0 && (
                          <button
                            onClick={() => openCorrection(item)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold"
                            title="Admin: correct a mis-entered payment"
                          >
                            Correct
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {installments.map((item) => (
              <div
                key={item.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <h3 className="font-bold text-yellow-400">
                    Installment #{item.installmentNo}
                  </h3>
                  <Badge status={item.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <Info label="Due Date" value={item.dueDate} />
                  <Info label="Amount" value={`Rs. ${money(item.amount)}`} />
                  <Info label="Paid" value={`Rs. ${money(item.paidAmount)}`} />
                  <Info
                    label="Remaining"
                    value={`Rs. ${money(item.remainingAmount)}`}
                  />
                  <Info label="Late Days" value={item.liveLateDays || 0} />
                  <Info label="Fine" value={`Rs. ${money(item.liveFineAmount)}`} />
                </div>

                {item.status !== "paid" ? (
                  <button
                    onClick={() => openPayment(item)}
                    className="mt-4 w-full bg-yellow-500 text-black py-3 rounded-xl font-bold"
                  >
                    Receive Payment
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setLastPayment(null);
                      setSelectedReceipt(item);
                    }}
                    className="mt-4 w-full bg-green-600 text-white py-3 rounded-xl font-bold"
                  >
                    View Receipt
                  </button>
                )}

                {isAdmin && Number(item.paidAmount || 0) > 0 && (
                  <button
                    onClick={() => openCorrection(item)}
                    className="mt-2 w-full bg-purple-600 text-white py-3 rounded-xl font-bold"
                  >
                    Correct Payment (Admin)
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      </>
      )}

      {view === "collections" && (
        <>
          {collectionsLoading ? (
            <p className="text-yellow-400">Loading monthly collections...</p>
          ) : !collections || collections.months.length === 0 ? (
            <p className="text-gray-400">No collections recorded yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Mini
                  title="Total Advance"
                  value={`Rs. ${money(collections.summary.totalAdvance)}`}
                />
                <Mini
                  title="Total Installment"
                  value={`Rs. ${money(collections.summary.totalInstallment)}`}
                />
                <Mini
                  title="Total Fine"
                  value={`Rs. ${money(collections.summary.totalFine)}`}
                />
                <Mini
                  title="Total Collected"
                  value={`Rs. ${money(collections.summary.totalCollected)}`}
                />
              </div>

              <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-5 mb-5">
                <h2 className="text-xl font-bold text-white mb-4">
                  Collections by Month
                </h2>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={collections.months.map((m) => ({
                        ...m,
                        label: monthLabel(m.month),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="label" stroke="#777" />
                      <YAxis stroke="#777" />
                      <Tooltip
                        contentStyle={{
                          background: "#090909",
                          border: "1px solid rgba(250,204,21,0.3)",
                          borderRadius: 14,
                          color: "#fff",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="advance" name="Advance" stackId="a" fill="#facc15" />
                      <Bar dataKey="installment" name="Installment" stackId="a" fill="#a855f7" />
                      <Bar dataKey="fine" name="Fine" stackId="a" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-yellow-500 text-black">
                    <tr>
                      <th className="p-3 text-left">Month</th>
                      <th className="p-3 text-left">Advance</th>
                      <th className="p-3 text-left">Installment</th>
                      <th className="p-3 text-left">Fine</th>
                      <th className="p-3 text-left">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {collections.months.map((m) => (
                      <tr
                        key={m.month}
                        className="border-t border-yellow-600/20 text-gray-200"
                      >
                        <td className="p-3">{monthLabel(m.month)}</td>
                        <td className="p-3">Rs. {money(m.advance)}</td>
                        <td className="p-3">Rs. {money(m.installment)}</td>
                        <td className="p-3 text-orange-300">
                          Rs. {money(m.fine)}
                        </td>
                        <td className="p-3 font-bold text-yellow-300">
                          Rs. {money(m.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden space-y-4">
                {collections.months.map((m) => (
                  <div
                    key={m.month}
                    className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
                  >
                    <h3 className="font-bold text-yellow-400 mb-3">
                      {monthLabel(m.month)}
                    </h3>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Info label="Advance" value={`Rs. ${money(m.advance)}`} />
                      <Info
                        label="Installment"
                        value={`Rs. ${money(m.installment)}`}
                      />
                      <Info label="Fine" value={`Rs. ${money(m.fine)}`} />
                      <Info label="Total" value={`Rs. ${money(m.total)}`} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <form
            onSubmit={submitPayment}
            className="w-full max-w-lg bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5"
          >
            <h2 className="text-xl font-bold text-yellow-400 mb-2">
              Receive Payment
            </h2>

            <p className="text-sm text-gray-400 mb-5">
              Installment #{paymentModal.installmentNo} — Due{" "}
              {paymentModal.dueDate}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <Mini
                title="Remaining"
                value={`Rs. ${money(paymentModal.remainingAmount)}`}
              />
              <Mini title="Fine" value={`Rs. ${money(paymentModal.liveFineAmount)}`} />
              <Mini title="Late Days" value={paymentModal.liveLateDays || 0} />
              <Mini
                title="Total Payable"
                value={`Rs. ${money(paymentModal.liveTotalPayable)}`}
              />
            </div>

            <input
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-white mb-3"
              placeholder="Amount Received"
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
              required
            />

            <input
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-white mb-3"
              placeholder="Fine Discount"
              value={paymentForm.fineDiscount}
              onChange={(e) =>
                setPaymentForm({
                  ...paymentForm,
                  fineDiscount: e.target.value,
                })
              }
            />

            <textarea
              className="w-full px-4 py-3 rounded-xl bg-white"
              placeholder="Notes"
              rows="3"
              value={paymentForm.notes}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, notes: e.target.value })
              }
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                disabled={submittingPayment}
                className="bg-gray-700 text-white py-3 rounded-xl font-bold disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submittingPayment}
                className="bg-yellow-500 text-black py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {submittingPayment ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {correctionModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <form
            onSubmit={submitCorrection}
            className="w-full max-w-lg bg-[#0b0b0b] border border-purple-600/40 rounded-3xl p-5"
          >
            <h2 className="text-xl font-bold text-purple-400 mb-2">
              Correct Payment (Admin)
            </h2>

            <p className="text-sm text-gray-400 mb-5">
              Installment #{correctionModal.installmentNo} — fixes a
              mis-entered payment. This updates the sale's totals but does not
              re-amortize future installments.
            </p>

            <label className="block text-xs text-gray-400 mb-1">
              Paid Amount
            </label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-white mb-3"
              value={correctionForm.paidAmount}
              onChange={(e) =>
                setCorrectionForm({
                  ...correctionForm,
                  paidAmount: e.target.value,
                })
              }
              required
            />

            <label className="block text-xs text-gray-400 mb-1">
              Fine Paid
            </label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-white mb-3"
              value={correctionForm.finePaid}
              onChange={(e) =>
                setCorrectionForm({
                  ...correctionForm,
                  finePaid: e.target.value,
                })
              }
            />

            <label className="block text-xs text-gray-400 mb-1">
              Fine Discount
            </label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-white mb-3"
              value={correctionForm.fineDiscount}
              onChange={(e) =>
                setCorrectionForm({
                  ...correctionForm,
                  fineDiscount: e.target.value,
                })
              }
            />

            <label className="block text-xs text-gray-400 mb-1">
              Paid Date
            </label>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-xl bg-white mb-3"
              value={correctionForm.paidDate}
              onChange={(e) =>
                setCorrectionForm({
                  ...correctionForm,
                  paidDate: e.target.value,
                })
              }
            />

            <label className="block text-xs text-gray-400 mb-1">
              Reason (required, saved to audit log)
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-white"
              placeholder="e.g. Cashier typed 2318.18 instead of 2500"
              rows="3"
              value={correctionForm.reason}
              onChange={(e) =>
                setCorrectionForm({
                  ...correctionForm,
                  reason: e.target.value,
                })
              }
              required
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                onClick={() => setCorrectionModal(null)}
                disabled={submittingCorrection}
                className="bg-gray-700 text-white py-3 rounded-xl font-bold disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submittingCorrection}
                className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {submittingCorrection ? "Saving..." : "Save Correction"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-yellow-400">
                Installment Receipt #{selectedReceipt.installmentNo}
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    printElement(`receipt-print-${selectedReceipt.id}`)
                  }
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Print
                </button>

                <button
                  onClick={() =>
                    downloadPdf(
                      `receipt-print-${selectedReceipt.id}`,
                      `receipt-${selectedReceipt.id}.pdf`
                    )
                  }
                  className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                >
                  PDF
                </button>

                <button
                  onClick={() => {
                    setSelectedReceipt(null);
                    setLastPayment(null);
                  }}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            <InstallmentReceiptPrint
              installment={selectedReceipt}
              payment={lastPayment}
              sale={selectedSale}
              installments={installments}
            />
          </div>
        </div>
      )}

      {dueModalOpen && dueThisMonth && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-yellow-400">
                This Month's Due Installments
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => printElement("due-this-month-print")}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Print
                </button>

                <button
                  onClick={() =>
                    downloadPdf(
                      "due-this-month-print",
                      `installments-due-${dueThisMonth.summary.month}.pdf`
                    )
                  }
                  className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                >
                  PDF
                </button>

                <button
                  onClick={() => setDueModalOpen(false)}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            <DueThisMonthPrint
              month={dueThisMonth.summary.month}
              summary={dueThisMonth.summary}
              installments={dueThisMonth.installments}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold capitalize">{value}</p>
  </div>
);

const Mini = ({ title, value }) => (
  <div className="bg-black/60 border border-yellow-600/20 rounded-xl p-3">
    <p className="text-gray-500 text-xs">{title}</p>
    <h3 className="text-yellow-300 font-bold">{value}</h3>
  </div>
);

const Badge = ({ status }) => {
  const style =
    status === "paid"
      ? "bg-green-600/20 text-green-300"
      : status === "partial"
        ? "bg-blue-600/20 text-blue-300"
        : "bg-yellow-600/20 text-yellow-300";

  return (
    <span className={`px-3 py-1 rounded-full text-xs capitalize ${style}`}>
      {status}
    </span>
  );
};

export default Installments;