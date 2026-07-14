import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const money = (v) => Number(v || 0).toLocaleString();

const emptyInvestor = {
  name: "",
  phone: "",
  cnic: "",
  address: "",
  investorType: "fixed_monthly",
  returnPercentage: "",
  notes: "",
  status: "active",
};

const emptyTransaction = {
  type: "investment",
  amount: "",
  description: "",
  transactionDate: "",
};

const transactionTypes = [
  { value: "investment", label: "Investment" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "return_credit", label: "Return Credit" },
  { value: "loss_debit", label: "Loss Debit" },
  { value: "adjustment", label: "Adjustment" },
];

const investorTypeOptions = [
  { value: "fixed_monthly", label: "Fixed Monthly Return" },
  { value: "fixed_yearly", label: "Fixed Yearly Return" },
  { value: "profit_share", label: "50/50 Profit Share" },
];

const investorTypeLabel = (type) =>
  investorTypeOptions.find((t) => t.value === type)?.label || type;

const isFixedType = (type) => type === "fixed_monthly" || type === "fixed_yearly";

const Investors = () => {
  const [investors, setInvestors] = useState([]);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [investorDetails, setInvestorDetails] = useState(null);

  const [investorForm, setInvestorForm] = useState(emptyInvestor);
  const [editingId, setEditingId] = useState(null);
  const [transactionForm, setTransactionForm] = useState(emptyTransaction);

  const [formOpen, setFormOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);

  const [filters, setFilters] = useState({ search: "", status: "", investorType: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadInvestors = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/investors");
      setInvestors(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load investors");
    } finally {
      setLoading(false);
    }
  };

  const loadInvestorDetails = async (investorId) => {
    try {
      const res = await api.get(`/investors/${investorId}`);
      setInvestorDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load investor ledger");
    }
  };

  useEffect(() => {
    loadInvestors();
  }, []);

  const filteredInvestors = useMemo(() => {
    return investors.filter((inv) => {
      const text = `${inv.name || ""} ${inv.phone || ""} ${inv.cnic || ""}`.toLowerCase();
      const matchesSearch = text.includes(filters.search.toLowerCase());
      const matchesStatus = !filters.status || inv.status === filters.status;
      const matchesType = !filters.investorType || inv.investorType === filters.investorType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [investors, filters]);

  const summary = useMemo(() => {
    return investors.reduce(
      (acc, inv) => {
        acc.totalInvested += Number(inv.totalInvested || 0);
        acc.totalWithdrawn += Number(inv.totalWithdrawn || 0);
        acc.totalReturns += Number(inv.totalReturns || 0);
        acc.currentBalance += Number(inv.currentBalance || 0);
        return acc;
      },
      { totalInvested: 0, totalWithdrawn: 0, totalReturns: 0, currentBalance: 0 }
    );
  }, [investors]);

  const submitInvestor = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        ...investorForm,
        returnPercentage: isFixedType(investorForm.investorType)
          ? Number(investorForm.returnPercentage || 0)
          : null,
      };

      if (editingId) {
        await api.put(`/investors/${editingId}`, payload);
      } else {
        await api.post("/investors", payload);
      }

      setInvestorForm(emptyInvestor);
      setEditingId(null);
      setFormOpen(false);
      await loadInvestors();
    } catch (err) {
      setError(err.response?.data?.message || "Save investor failed");
    }
  };

  const startEdit = (investor) => {
    setEditingId(investor.id);
    setInvestorForm({
      name: investor.name || "",
      phone: investor.phone || "",
      cnic: investor.cnic || "",
      address: investor.address || "",
      investorType: investor.investorType || "fixed_monthly",
      returnPercentage: investor.returnPercentage || "",
      notes: investor.notes || "",
      status: investor.status || "active",
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInvestorForm(emptyInvestor);
    setFormOpen(false);
  };

  const deleteInvestor = async (investor) => {
    const ok = window.confirm(`Delete investor ${investor.name}?`);
    if (!ok) return;

    try {
      await api.delete(`/investors/${investor.id}`);

      if (selectedInvestor?.id === investor.id) {
        setSelectedInvestor(null);
        setInvestorDetails(null);
      }

      loadInvestors();
    } catch (err) {
      setError(err.response?.data?.message || "Delete investor failed");
    }
  };

  const openLedger = async (investor) => {
    setSelectedInvestor(investor);
    setTransactionOpen(false);
    await loadInvestorDetails(investor.id);
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post(`/investors/${selectedInvestor.id}/transactions`, {
        ...transactionForm,
        amount: Number(transactionForm.amount || 0),
        transactionDate:
          transactionForm.transactionDate ||
          new Date().toISOString().split("T")[0],
      });

      setTransactionForm(emptyTransaction);
      setTransactionOpen(false);

      await loadInvestorDetails(selectedInvestor.id);
      await loadInvestors();
    } catch (err) {
      setError(err.response?.data?.message || "Add transaction failed");
    }
  };

  const badgeClass = (type) => {
    if (type === "investment") return "bg-green-600/20 text-green-300";
    if (type === "withdrawal" || type === "loss_debit") {
      return "bg-red-600/20 text-red-300";
    }
    return "bg-yellow-600/20 text-yellow-300";
  };

  const calculated = investorDetails?.calculated;

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Investors
          </h1>
          <p className="text-gray-400 text-sm">
            Fixed monthly/yearly return investors and 50/50 profit-share investors.
          </p>
        </div>

        <button
          onClick={() => {
            setFormOpen(!formOpen);
            setEditingId(null);
            setInvestorForm(emptyInvestor);
          }}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add Investor"}
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 mb-6">
        <SummaryCard title="Invested" value={summary.totalInvested} />
        <SummaryCard title="Withdrawn" value={summary.totalWithdrawn} />
        <SummaryCard title="Returns Paid" value={summary.totalReturns} />
        <SummaryCard title="Balance" value={summary.currentBalance} />
      </div>

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Search name, phone, CNIC..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.investorType}
            onChange={(e) => setFilters({ ...filters, investorType: e.target.value })}
          >
            <option value="">All Types</option>
            {investorTypeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={() => setFilters({ search: "", status: "", investorType: "" })}
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
          onSubmit={submitInvestor}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            {editingId ? "Edit Investor" : "Add Investor"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Investor Name"
              value={investorForm.name}
              onChange={(e) => setInvestorForm({ ...investorForm, name: e.target.value })}
              required
            />

            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Phone"
              value={investorForm.phone}
              onChange={(e) => setInvestorForm({ ...investorForm, phone: e.target.value })}
            />

            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="CNIC"
              value={investorForm.cnic}
              onChange={(e) => setInvestorForm({ ...investorForm, cnic: e.target.value })}
            />

            <select
              className="px-4 py-3 rounded-xl bg-white"
              value={investorForm.status}
              onChange={(e) => setInvestorForm({ ...investorForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              className="px-4 py-3 rounded-xl bg-white"
              value={investorForm.investorType}
              onChange={(e) =>
                setInvestorForm({ ...investorForm, investorType: e.target.value })
              }
            >
              {investorTypeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {isFixedType(investorForm.investorType) && (
              <input
                type="number"
                step="0.01"
                className="px-4 py-3 rounded-xl bg-white"
                placeholder={
                  investorForm.investorType === "fixed_monthly"
                    ? "Monthly Return %"
                    : "Yearly Return %"
                }
                value={investorForm.returnPercentage}
                onChange={(e) =>
                  setInvestorForm({ ...investorForm, returnPercentage: e.target.value })
                }
                required
              />
            )}

            <input
              className="px-4 py-3 rounded-xl bg-white md:col-span-2"
              placeholder="Address"
              value={investorForm.address}
              onChange={(e) => setInvestorForm({ ...investorForm, address: e.target.value })}
            />

            <textarea
              className="px-4 py-3 rounded-xl bg-white md:col-span-2"
              placeholder="Notes"
              rows="3"
              value={investorForm.notes}
              onChange={(e) => setInvestorForm({ ...investorForm, notes: e.target.value })}
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
              {editingId ? "Update Investor" : "Save Investor"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1">
          <h2 className="text-lg font-bold text-yellow-400 mb-3">Investor List</h2>

          {loading ? (
            <p className="text-yellow-400">Loading investors...</p>
          ) : (
            <div className="space-y-4">
              {filteredInvestors.map((investor) => (
                <div
                  key={investor.id}
                  onClick={() => openLedger(investor)}
                  className={`cursor-pointer bg-black/75 border rounded-2xl p-4 transition ${
                    selectedInvestor?.id === investor.id
                      ? "border-yellow-400"
                      : "border-yellow-600/30"
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-yellow-400">{investor.name}</h3>
                      <p className="text-sm text-gray-400">{investor.phone || "-"}</p>
                    </div>

                    <span
                      className={`h-fit px-3 py-1 rounded-full text-xs capitalize ${
                        investor.status === "active"
                          ? "bg-green-600/20 text-green-300"
                          : "bg-red-600/20 text-red-300"
                      }`}
                    >
                      {investor.status}
                    </span>
                  </div>

                  <p className="text-xs text-yellow-300 mt-2">
                    {investorTypeLabel(investor.investorType)}
                    {isFixedType(investor.investorType)
                      ? ` — ${investor.returnPercentage}%`
                      : ""}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <Info label="Invested" value={investor.totalInvested} />
                    <Info label="Withdrawn" value={investor.totalWithdrawn} />
                    <Info label="Returns Paid" value={investor.totalReturns} />
                    <Info label="Balance" value={investor.currentBalance} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(investor);
                      }}
                      className="bg-yellow-500 text-black py-3 rounded-xl font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInvestor(investor);
                      }}
                      className="bg-red-600 text-white py-3 rounded-xl font-bold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          {!selectedInvestor ? (
            <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-8 text-center">
              <img src="/logo.png" className="h-20 mx-auto opacity-60 mb-4" />
              <h2 className="text-xl font-bold text-yellow-400">Select Investor</h2>
              <p className="text-gray-400 text-sm">
                Tap an investor to view their ledger and calculated return.
              </p>
            </div>
          ) : (
            <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
                    {selectedInvestor.name} Ledger
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {investorTypeLabel(selectedInvestor.investorType)} | CNIC:{" "}
                    {selectedInvestor.cnic || "-"} | Phone: {selectedInvestor.phone || "-"}
                  </p>
                </div>

                <button
                  onClick={() => setTransactionOpen(!transactionOpen)}
                  className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full md:w-auto"
                >
                  {transactionOpen ? "Close" : "+ Add Transaction"}
                </button>
              </div>

              {calculated && (
                <div className="bg-black/60 border border-yellow-600/20 rounded-2xl p-4 mb-5">
                  <h3 className="text-lg font-bold text-yellow-400 mb-3">
                    Calculated Return
                  </h3>

                  {isFixedType(investorDetails.investor.investorType) ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <MiniStat
                        title={`${calculated.period === "monthly" ? "Monthly" : "Yearly"} Due`}
                        value={calculated.periodDue}
                      />
                      <MiniInfo
                        title="Return %"
                        value={`${selectedInvestor.returnPercentage || 0}%`}
                      />
                      <MiniInfo
                        title="On Principal"
                        value={`Rs. ${money(selectedInvestor.totalInvested)}`}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <MiniStat title="Profit Recovered" value={calculated.totalProfitRecovered} />
                        <MiniStat title="Profit Pending" value={calculated.totalProfitPending} />
                        <MiniStat title="Lifetime Share (50%)" value={calculated.lifetimeProfitShare} />
                        <MiniStat title="Pending To Credit" value={calculated.pendingToCredit} />
                      </div>

                      <h4 className="text-sm font-bold text-yellow-300 mb-2">
                        Funded Items Sold
                      </h4>

                      {calculated.fundedSales?.length ? (
                        <div className="space-y-2">
                          {calculated.fundedSales.map((sale) => (
                            <div
                              key={sale.id}
                              className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-black/40 border border-yellow-600/10 rounded-xl p-3 text-xs text-gray-200"
                            >
                              <span className="text-yellow-300 font-bold">
                                {sale.product?.productName || "Product"}
                              </span>
                              <span>Sale: Rs. {money(sale.finalAmount)}</span>
                              <span>Profit Recovered: Rs. {money(sale.profitRecovered)}</span>
                              <span>Investor Share: Rs. {money(Number(sale.profitRecovered || 0) * 0.5)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          No funded items have sold yet.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {transactionOpen && (
                <form
                  onSubmit={addTransaction}
                  className="bg-black/60 border border-yellow-600/30 rounded-2xl p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <select
                    className="px-4 py-3 rounded-xl bg-white"
                    value={transactionForm.type}
                    onChange={(e) =>
                      setTransactionForm({ ...transactionForm, type: e.target.value })
                    }
                  >
                    {transactionTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    className="px-4 py-3 rounded-xl bg-white"
                    placeholder="Amount"
                    value={transactionForm.amount}
                    onChange={(e) =>
                      setTransactionForm({ ...transactionForm, amount: e.target.value })
                    }
                    required
                  />

                  <input
                    type="date"
                    className="px-4 py-3 rounded-xl bg-white"
                    value={transactionForm.transactionDate}
                    onChange={(e) =>
                      setTransactionForm({
                        ...transactionForm,
                        transactionDate: e.target.value,
                      })
                    }
                  />

                  <input
                    className="px-4 py-3 rounded-xl bg-white"
                    placeholder="Description"
                    value={transactionForm.description}
                    onChange={(e) =>
                      setTransactionForm({
                        ...transactionForm,
                        description: e.target.value,
                      })
                    }
                  />

                  <button className="md:col-span-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
                    Save Transaction
                  </button>
                </form>
              )}

              <div className="hidden md:block overflow-hidden rounded-2xl border border-yellow-600/30">
                <table className="w-full">
                  <thead className="bg-yellow-500 text-black">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(investorDetails?.transactions || []).map((trx) => (
                      <tr key={trx.id} className="border-t border-yellow-600/20 text-gray-200">
                        <td className="p-3">{trx.transactionDate}</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs ${badgeClass(trx.type)}`}>
                            {trx.type}
                          </span>
                        </td>
                        <td className="p-3">{trx.description || "-"}</td>
                        <td className="p-3 text-right font-bold">Rs. {money(trx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {(investorDetails?.transactions || []).map((trx) => (
                  <div key={trx.id} className="bg-black/60 border border-yellow-600/20 rounded-xl p-4">
                    <div className="flex justify-between gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs ${badgeClass(trx.type)}`}>
                        {trx.type}
                      </span>

                      <strong className="text-yellow-300">Rs. {money(trx.amount)}</strong>
                    </div>

                    <p className="text-gray-400 text-sm mt-2">{trx.transactionDate}</p>
                    <p className="text-gray-300 text-sm mt-1">{trx.description || "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value }) => (
  <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4">
    <p className="text-gray-400 text-xs">{title}</p>
    <h2 className="text-xl md:text-2xl font-bold text-yellow-400">Rs. {money(value)}</h2>
  </div>
);

const MiniInfo = ({ title, value }) => (
  <div className="bg-black/50 border border-yellow-600/20 rounded-xl p-3">
    <p className="text-gray-500 text-xs">{title}</p>
    <p className="text-yellow-300 font-bold">{value || "-"}</p>
  </div>
);

const MiniStat = ({ title, value }) => (
  <div className="bg-black/60 border border-yellow-600/20 rounded-xl p-3">
    <p className="text-gray-500 text-xs">{title}</p>
    <h3 className="text-lg font-bold text-yellow-300">Rs. {money(value)}</h3>
  </div>
);

const Info = ({ label, value, plain }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold">{plain ? value : `Rs. ${money(value)}`}</p>
  </div>
);

export default Investors;
