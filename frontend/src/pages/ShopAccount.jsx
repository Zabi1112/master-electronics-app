import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const money = (v) => Number(v || 0).toLocaleString();

const emptyAdjustment = {
  amount: "",
  description: "",
  transactionDate: "",
};

const sourceTypeLabels = {
  advance_payment: "Advance Payment",
  installment_payment: "Installment Payment",
  fine_payment: "Fine Payment",
  cash_sale: "Cash Sale",
  purchase: "Purchase",
  expense: "Expense",
  adjustment: "Adjustment",
};

const ShopAccount = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({ sourceType: "", from: "", to: "" });
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAccount = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/shop-account");
      setAccount(res.data.account);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load shop account");
    } finally {
      setLoading(false);
    }
  };

  const loadFiltered = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filters.sourceType) params.append("sourceType", filters.sourceType);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);

      const res = await api.get(`/shop-account/transactions?${params.toString()}`);
      setTransactions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Filter failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
  }, []);

  const badgeClass = (type) => {
    if (type === "collection") return "bg-green-600/20 text-green-300";
    if (type === "usage") return "bg-red-600/20 text-red-300";
    return "bg-yellow-600/20 text-yellow-300";
  };

  const submitAdjustment = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/shop-account/adjustments", {
        ...adjustmentForm,
        amount: Number(adjustmentForm.amount || 0),
        transactionDate:
          adjustmentForm.transactionDate ||
          new Date().toISOString().split("T")[0],
      });

      setAdjustmentForm(emptyAdjustment);
      setAdjustmentOpen(false);
      await loadAccount();
    } catch (err) {
      setError(err.response?.data?.message || "Add adjustment failed");
    }
  };

  const resetFilters = () => {
    setFilters({ sourceType: "", from: "", to: "" });
    loadAccount();
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Shop Account
          </h1>
          <p className="text-gray-400 text-sm">
            Recovered money (advances, installments, fines, cash sales) recycled
            back into purchases and expenses.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAdjustmentOpen(!adjustmentOpen)}
            className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
          >
            {adjustmentOpen ? "Close" : "+ Add Adjustment"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5 mb-6">
        <SummaryCard title="Current Balance" value={account?.currentBalance} />
        <SummaryCard title="Total Collected" value={account?.totalCollected} />
        <SummaryCard title="Total Used" value={account?.totalUsed} />
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {adjustmentOpen && (
        <form
          onSubmit={submitAdjustment}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-1 md:col-span-2">
            Add Adjustment
          </h2>

          <input
            type="number"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Amount (negative to deduct)"
            value={adjustmentForm.amount}
            onChange={(e) =>
              setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })
            }
            required
          />

          <input
            type="date"
            className="px-4 py-3 rounded-xl bg-white"
            value={adjustmentForm.transactionDate}
            onChange={(e) =>
              setAdjustmentForm({
                ...adjustmentForm,
                transactionDate: e.target.value,
              })
            }
          />

          <input
            className="px-4 py-3 rounded-xl bg-white md:col-span-2"
            placeholder="Description"
            value={adjustmentForm.description}
            onChange={(e) =>
              setAdjustmentForm({
                ...adjustmentForm,
                description: e.target.value,
              })
            }
          />

          <button className="md:col-span-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Save Adjustment
          </button>
        </form>
      )}

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.sourceType}
            onChange={(e) =>
              setFilters({ ...filters, sourceType: e.target.value })
            }
          >
            <option value="">All Sources</option>
            {Object.entries(sourceTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />

          <input
            type="date"
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadFiltered}
              className="bg-yellow-500 text-black font-bold rounded-xl py-3"
            >
              Apply
            </button>
            <button
              onClick={resetFilters}
              className="bg-gray-700 text-white font-bold rounded-xl py-3"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-yellow-400">Loading shop account...</p>
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-2xl border border-yellow-600/30">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Source</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((trx) => (
                  <tr
                    key={trx.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">{trx.transactionDate}</td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${badgeClass(
                          trx.type
                        )}`}
                      >
                        {trx.type}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {sourceTypeLabels[trx.sourceType] || "-"}
                    </td>
                    <td className="p-3">{trx.description || "-"}</td>
                    <td className="p-3 text-right font-bold">
                      Rs. {money(trx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {transactions.map((trx) => (
              <div
                key={trx.id}
                className="bg-black/60 border border-yellow-600/20 rounded-xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs ${badgeClass(
                      trx.type
                    )}`}
                  >
                    {trx.type}
                  </span>

                  <strong className="text-yellow-300">
                    Rs. {money(trx.amount)}
                  </strong>
                </div>

                <p className="text-gray-400 text-sm mt-2">
                  {trx.transactionDate} · {sourceTypeLabels[trx.sourceType] || "-"}
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  {trx.description || "-"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value }) => (
  <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4">
    <p className="text-gray-400 text-xs">{title}</p>
    <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
      Rs. {money(value)}
    </h2>
  </div>
);

export default ShopAccount;
