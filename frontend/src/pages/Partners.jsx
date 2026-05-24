import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const money = (v) => Number(v || 0).toLocaleString();

const emptyPartner = {
  name: "",
  phone: "",
  cnic: "",
  address: "",
  notes: "",
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
  { value: "loss_debit", label: "Loss Debit" },
  { value: "adjustment", label: "Adjustment" },
];

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [profitShares, setProfitShares] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partnerDetails, setPartnerDetails] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);

  const [partnerForm, setPartnerForm] = useState(emptyPartner);
  const [transactionForm, setTransactionForm] = useState(emptyTransaction);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPartners = async () => {
    setLoading(true);
    setError("");

    try {
      const [partnersRes, sharesRes] = await Promise.all([
        api.get("/partners"),
        api.get("/finance/partners/profit-shares"),
      ]);

      setPartners(partnersRes.data);
      setProfitShares(sharesRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load partners");
    } finally {
      setLoading(false);
    }
  };

  const loadPartnerDetails = async (partnerId) => {
    try {
      const res = await api.get(`/partners/${partnerId}`);
      setPartnerDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load partner ledger");
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const getShare = (partnerId) => {
    return profitShares?.shares?.find(
      (s) => String(s.partnerId) === String(partnerId)
    );
  };

  const partnersWithCalculatedBalance = useMemo(() => {
    return partners.map((partner) => {
      const share = getShare(partner.id);

      return {
        ...partner,
        autoProfitShare: Number(share?.profitShare || 0),
        calculatedBalance:
          share?.calculatedBalance !== undefined
            ? Number(share.calculatedBalance || 0)
            : Number(partner.currentBalance || 0),
        sharePercentage: Number(share?.percentage || 0),
      };
    });
  }, [partners, profitShares]);

  const summary = useMemo(() => {
    return partnersWithCalculatedBalance.reduce(
      (acc, p) => {
        acc.totalInvested += Number(p.totalInvested || 0);
        acc.totalWithdrawn += Number(p.totalWithdrawn || 0);
        acc.autoProfitShare += Number(p.autoProfitShare || 0);
        acc.lossShare += Number(p.lossShare || 0);
        acc.calculatedBalance += Number(p.calculatedBalance || 0);
        return acc;
      },
      {
        totalInvested: 0,
        totalWithdrawn: 0,
        autoProfitShare: 0,
        lossShare: 0,
        calculatedBalance: 0,
      }
    );
  }, [partnersWithCalculatedBalance]);

  const createPartner = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/partners", partnerForm);
      setPartnerForm(emptyPartner);
      setFormOpen(false);
      loadPartners();
    } catch (err) {
      setError(err.response?.data?.message || "Create partner failed");
    }
  };

  const openLedger = async (partner) => {
    setSelectedPartner(partner);
    setTransactionOpen(false);
    await loadPartnerDetails(partner.id);
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post(`/partners/${selectedPartner.id}/transactions`, {
        ...transactionForm,
        amount: Number(transactionForm.amount || 0),
        transactionDate:
          transactionForm.transactionDate ||
          new Date().toISOString().split("T")[0],
      });

      setTransactionForm(emptyTransaction);
      setTransactionOpen(false);

      await loadPartnerDetails(selectedPartner.id);
      await loadPartners();
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

  const selectedCalculated = selectedPartner
    ? partnersWithCalculatedBalance.find(
        (p) => String(p.id) === String(selectedPartner.id)
      )
    : null;

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Partners
          </h1>
          <p className="text-gray-400 text-sm">
            Partner investment, withdrawals, auto profit share, and calculated balance.
          </p>
        </div>

        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add Partner"}
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-5 mb-6">
        <SummaryCard title="Invested" value={summary.totalInvested} />
        <SummaryCard title="Withdrawn" value={summary.totalWithdrawn} />
        <SummaryCard title="Auto Profit" value={summary.autoProfitShare} />
        <SummaryCard title="Loss" value={summary.lossShare} />
        <SummaryCard title="Calculated Balance" value={summary.calculatedBalance} />
      </div>

      {profitShares && (
        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 mb-6">
          <h2 className="text-lg font-bold text-yellow-400 mb-3">
            Profit Distribution
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <MiniInfo title="Month" value={profitShares.month} />
            <MiniInfo title="Method" value={profitShares.method} />
            <MiniInfo title="Gross Profit" value={`Rs. ${money(profitShares.grossProfit)}`} />
            <MiniInfo title="Donation Deducted" value={`Rs. ${money(profitShares.donationAmount)}`} />
            <MiniInfo title="Net Profit" value={`Rs. ${money(profitShares.netProfitAfterDonation)}`} />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={createPartner}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Partner Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Partner Name"
              value={partnerForm.name}
              onChange={(e) =>
                setPartnerForm({ ...partnerForm, name: e.target.value })
              }
              required
            />

            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Phone"
              value={partnerForm.phone}
              onChange={(e) =>
                setPartnerForm({ ...partnerForm, phone: e.target.value })
              }
            />

            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="CNIC"
              value={partnerForm.cnic}
              onChange={(e) =>
                setPartnerForm({ ...partnerForm, cnic: e.target.value })
              }
            />

            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Address"
              value={partnerForm.address}
              onChange={(e) =>
                setPartnerForm({ ...partnerForm, address: e.target.value })
              }
            />

            <textarea
              className="px-4 py-3 rounded-xl bg-white md:col-span-2"
              placeholder="Notes"
              rows="3"
              value={partnerForm.notes}
              onChange={(e) =>
                setPartnerForm({ ...partnerForm, notes: e.target.value })
              }
            />
          </div>

          <button className="mt-5 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Save Partner
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-1">
          <h2 className="text-lg font-bold text-yellow-400 mb-3">
            Partner List
          </h2>

          {loading ? (
            <p className="text-yellow-400">Loading partners...</p>
          ) : (
            <div className="space-y-4">
              {partnersWithCalculatedBalance.map((partner) => (
                <div
                  key={partner.id}
                  onClick={() => openLedger(partner)}
                  className={`cursor-pointer bg-black/75 border rounded-2xl p-4 transition ${
                    selectedPartner?.id === partner.id
                      ? "border-yellow-400"
                      : "border-yellow-600/30"
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-yellow-400">
                        {partner.name}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {partner.phone || "-"}
                      </p>
                    </div>

                    <span className="h-fit px-3 py-1 rounded-full bg-green-600/20 text-green-300 text-xs capitalize">
                      {partner.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <Info label="Invested" value={partner.totalInvested} />
                    <Info label="Withdrawn" value={partner.totalWithdrawn} />
                    <Info label="Auto Profit" value={partner.autoProfitShare} />
                    <Info label="Balance" value={partner.calculatedBalance} />
                  </div>

                  <div className="mt-3 bg-yellow-500/10 rounded-xl p-3">
                    <p className="text-xs text-gray-400">Share Percentage</p>
                    <p className="text-yellow-300 font-bold">
                      {partner.sharePercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          {!selectedPartner ? (
            <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-8 text-center">
              <img src="/logo.png" className="h-20 mx-auto opacity-60 mb-4" />
              <h2 className="text-xl font-bold text-yellow-400">
                Select Partner
              </h2>
              <p className="text-gray-400 text-sm">
                Tap a partner to view calculated balance and ledger.
              </p>
            </div>
          ) : (
            <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
                    {selectedPartner.name} Ledger
                  </h2>
                  <p className="text-gray-400 text-sm">
                    CNIC: {selectedPartner.cnic || "-"} | Phone:{" "}
                    {selectedPartner.phone || "-"}
                  </p>
                </div>

                <button
                  onClick={() => setTransactionOpen(!transactionOpen)}
                  className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full md:w-auto"
                >
                  {transactionOpen ? "Close" : "+ Add Transaction"}
                </button>
              </div>

              {selectedCalculated && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  <MiniStat title="Invested" value={selectedCalculated.totalInvested} />
                  <MiniStat title="Withdrawn" value={selectedCalculated.totalWithdrawn} />
                  <MiniStat title="Auto Profit" value={selectedCalculated.autoProfitShare} />
                  <MiniStat title="Loss" value={selectedCalculated.lossShare} />
                  <MiniStat title="Balance" value={selectedCalculated.calculatedBalance} />
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
                      setTransactionForm({
                        ...transactionForm,
                        type: e.target.value,
                      })
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
                      setTransactionForm({
                        ...transactionForm,
                        amount: e.target.value,
                      })
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
                    {(partnerDetails?.transactions || []).map((trx) => (
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
                {(partnerDetails?.transactions || []).map((trx) => (
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
                      {trx.transactionDate}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">
                      {trx.description || "-"}
                    </p>
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
    <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
      Rs. {money(value)}
    </h2>
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
    <h3 className="text-lg font-bold text-yellow-300">
      Rs. {money(value)}
    </h3>
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold">Rs. {money(value)}</p>
  </div>
);

export default Partners;