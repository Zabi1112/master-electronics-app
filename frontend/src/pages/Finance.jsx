import { useEffect, useState } from "react";
import api from "../api/api";

const money = (v) => Number(v || 0).toLocaleString();

const Finance = () => {
  const [settings, setSettings] = useState(null);
  const [donation, setDonation] = useState(null);
  const [records, setRecords] = useState([]);
  const [shares, setShares] = useState(null);
  const [error, setError] = useState("");

  const loadFinance = async () => {
    try {
      const [settingsRes, donationRes, recordsRes, sharesRes] =
        await Promise.all([
          api.get("/finance/settings"),
          api.get("/finance/donation/current"),
          api.get("/finance/donation/records"),
          api.get("/finance/partners/profit-shares"),
        ]);

      setSettings(settingsRes.data);
      setDonation(donationRes.data);
      setRecords(recordsRes.data);
      setShares(sharesRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load finance data");
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const updateSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put("/finance/settings", settings);
      loadFinance();
    } catch (err) {
      setError(err.response?.data?.message || "Settings update failed");
    }
  };

  const markDonationPaid = async () => {
    try {
      await api.put("/finance/donation/mark-paid", {
        month: donation.month,
        notes: "Donation marked as paid",
      });
      loadFinance();
    } catch (err) {
      setError(err.response?.data?.message || "Mark donation failed");
    }
  };

  if (!settings) {
    return <p className="text-yellow-400">Loading finance settings...</p>;
  }

  return (
    <div className="pb-24 md:pb-4">
      <h1 className="text-2xl md:text-3xl font-bold text-yellow-400 mb-2">
        Finance Settings
      </h1>

      <p className="text-gray-400 text-sm mb-6">
        Manage donation percentage and automatic partner profit calculation.
      </p>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form
          onSubmit={updateSettings}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-5"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Business Settings
          </h2>

          <label className="text-sm text-gray-400">Profit Share Method</label>
          <select
            className="w-full px-4 py-3 rounded-xl bg-white mb-4"
            value={settings.profitShareMethod}
            onChange={(e) =>
              setSettings({ ...settings, profitShareMethod: e.target.value })
            }
          >
            <option value="investment_based">Investment Based</option>
            <option value="equal">Equal Share</option>
          </select>

          <label className="text-sm text-gray-400">Donation Percentage</label>
          <input
            type="number"
            step="0.1"
            className="w-full px-4 py-3 rounded-xl bg-white mb-4"
            value={settings.donationPercentage}
            onChange={(e) =>
              setSettings({
                ...settings,
                donationPercentage: Number(e.target.value),
              })
            }
          />

          <label className="flex items-center gap-3 text-gray-300 mb-5">
            <input
              type="checkbox"
              checked={settings.donationReminderEnabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  donationReminderEnabled: e.target.checked,
                })
              }
            />
            Enable Donation Reminder
          </label>

          <button className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl">
            Save Settings
          </button>
        </form>

        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Donation Due
          </h2>

          <Mini title="Month" value={donation?.month} />
          <Mini title="Gross Profit" value={`Rs. ${money(shares?.grossProfit)}`} />
          <Mini title="Donation %" value={`${shares?.donationPercentage || 0}%`} />
          <Mini title="Donation Deduction" value={`Rs. ${money(shares?.donationAmount)}`} />
          <Mini title="Net Profit" value={`Rs. ${money(shares?.netProfitAfterDonation)}`} />

          {donation?.isDue ? (
            <button
              onClick={markDonationPaid}
              className="mt-5 w-full bg-green-500 text-black font-bold py-3 rounded-xl"
            >
              Mark Donation Paid
            </button>
          ) : (
            <div className="mt-5 bg-green-600/20 text-green-300 rounded-xl p-3 text-center">
              Donation is paid
            </div>
          )}
        </div>

        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Partner Profit Summary
          </h2>

          <Mini title="Month" value={shares?.month} />
          <Mini title="Method" value={shares?.method} />
          <Mini title="Gross Profit" value={`Rs. ${money(shares?.grossProfit)}`} />
          <Mini title="Donation Deducted" value={`Rs. ${money(shares?.donationAmount)}`} />
          <Mini title="Net Profit To Divide" value={`Rs. ${money(shares?.netProfitAfterDonation)}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-6">
        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Auto Partner Share Breakdown
          </h2>

          <div className="space-y-3">
            {(shares?.shares || []).map((s) => (
              <div
                key={s.partnerId}
                className="bg-black/50 border border-yellow-600/20 rounded-xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{s.partnerName}</h3>
                    <p className="text-gray-400 text-sm">
                      Investment: Rs. {money(s.totalInvested)}
                    </p>
                    <p className="text-gray-400 text-sm">
                      Share: {Number(s.percentage || 0).toFixed(2)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-yellow-300 font-bold">
                      Profit: Rs. {money(s.profitShare)}
                    </p>
                    <p className="text-green-300 text-sm">
                      Balance: Rs. {money(s.calculatedBalance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {(!shares?.shares || shares.shares.length === 0) && (
              <p className="text-gray-400 text-sm">No active partners found.</p>
            )}
          </div>
        </div>

        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Donation History
          </h2>

          <div className="hidden md:block overflow-hidden rounded-xl border border-yellow-600/20">
            <table className="w-full text-sm">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Month</th>
                  <th className="p-3 text-left">Profit</th>
                  <th className="p-3 text-left">Donation</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>

              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-yellow-600/20">
                    <td className="p-3">{r.month}</td>
                    <td className="p-3">Rs. {money(r.profitAmount)}</td>
                    <td className="p-3">Rs. {money(r.donationAmount)}</td>
                    <td className="p-3 capitalize">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                className="bg-black/50 border border-yellow-600/20 rounded-xl p-4"
              >
                <div className="flex justify-between">
                  <strong className="text-yellow-400">{r.month}</strong>
                  <span className="capitalize">{r.status}</span>
                </div>

                <p className="text-sm text-gray-400 mt-2">
                  Profit: Rs. {money(r.profitAmount)}
                </p>

                <p className="text-sm text-gray-400">
                  Donation: Rs. {money(r.donationAmount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Mini = ({ title, value }) => (
  <div className="bg-black/50 border border-yellow-600/20 rounded-xl p-3 mb-3">
    <p className="text-gray-500 text-xs">{title}</p>
    <h3 className="text-yellow-300 font-bold">{value || "-"}</h3>
  </div>
);

export default Finance;