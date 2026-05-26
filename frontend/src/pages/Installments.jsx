import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { downloadPdf, printElement } from "../utils/pdfUtils";
import InstallmentReceiptPrint from "../components/InstallmentReceiptPrint.jsx";

const money = (v) => Number(v || 0).toLocaleString();

const Installments = () => {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [installments, setInstallments] = useState([]);

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

  useEffect(() => {
    loadCustomers();
  }, []);

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
    setError("");

    try {
      await api.put(`/installments/${paymentModal.id}/pay`, {
        amount: Number(paymentForm.amount || 0),
        fineDiscount: Number(paymentForm.fineDiscount || 0),
        notes: paymentForm.notes,
      });

      setPaymentModal(null);

      if (selectedSale) {
        await loadSaleInstallments(selectedSale);
        await loadCustomerItems(selectedCustomer);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Payment failed");
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

        {(selectedCustomer || selectedSale) && (
          <button
            onClick={resetSelection}
            className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl"
          >
            Back to Customers
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

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
                      {item.status !== "paid" ? (
                        <button
                          onClick={() => openPayment(item)}
                          className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold"
                        >
                          Pay
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedReceipt(item)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold"
                        >
                          Receipt
                        </button>
                      )}
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
                    onClick={() => setSelectedReceipt(item)}
                    className="mt-4 w-full bg-green-600 text-white py-3 rounded-xl font-bold"
                  >
                    View Receipt
                  </button>
                )}
              </div>
            ))}
          </div>
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
                className="bg-gray-700 text-white py-3 rounded-xl font-bold"
              >
                Cancel
              </button>

              <button className="bg-yellow-500 text-black py-3 rounded-xl font-bold">
                Save Payment
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
                  onClick={() => setSelectedReceipt(null)}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl font-bold"
                >
                  Close
                </button>
              </div>
            </div>

            <InstallmentReceiptPrint
              installment={selectedReceipt}
              sale={selectedSale}
              installments={installments}
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