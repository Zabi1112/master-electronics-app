import { useState } from "react";
import api from "../api/api";

const reportOptions = [
  { key: "sales", label: "Sales Report", url: "/reports/sales" },
  { key: "installments", label: "Installment Report", url: "/reports/installments" },
  { key: "overdue", label: "Overdue Report", url: "/reports/overdue" },
  { key: "inventory", label: "Inventory Report", url: "/reports/inventory" },
  { key: "partners", label: "Partner Report", url: "/reports/partners" },
  { key: "profit", label: "Profit Report", url: "/reports/profit" },
  { key: "customers", label: "Customer Report", url: "/reports/customers" },
];

const Reports = () => {
  const [selected, setSelected] = useState(reportOptions[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");

    try {
      let url = selected.url;

      if (["sales", "installments", "profit"].includes(selected.key)) {
        const params = [];
        if (from) params.push(`from=${from}`);
        if (to) params.push(`to=${to}`);
        if (params.length) url += `?${params.join("&")}`;
      }

      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary || {};

  const getRows = () => {
    if (!data) return [];

    if (selected.key === "sales") return data.sales || [];
    if (selected.key === "installments") return data.installments || [];
    if (selected.key === "overdue") return data.overdueInstallments || [];
    if (selected.key === "inventory") return data.products || [];
    if (selected.key === "partners") return data.partners || [];
    if (selected.key === "profit") return data.sales || [];
    if (selected.key === "customers") return data.customers || [];

    return [];
  };

  const rows = getRows();

  const printReport = () => {
    window.print();
  };

  return (
    <div className="pb-24 md:pb-4 print:bg-white print:text-black">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Reports
          </h1>
          <p className="text-gray-400 text-sm">
            View sales, installments, inventory, partners, profit and customer reports.
          </p>
        </div>

        <button
          onClick={printReport}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full md:w-auto"
        >
          Print Report
        </button>
      </div>

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={selected.key}
            onChange={(e) => {
              const option = reportOptions.find((r) => r.key === e.target.value);
              setSelected(option);
              setData(null);
            }}
          >
            {reportOptions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="px-4 py-3 rounded-xl bg-white"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />

          <input
            type="date"
            className="px-4 py-3 rounded-xl bg-white"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />

          <button
            onClick={loadReport}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl"
          >
            Load Report
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4 print:hidden">
          {error}
        </div>
      )}

      {loading && <p className="text-yellow-400">Loading report...</p>}

      {data && (
        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 print:bg-white print:border-0">
          <div className="hidden print:block text-center mb-6">
            <img src="/logo.png" className="h-20 mx-auto mb-2" />
            <h1 className="text-2xl font-bold">Master Electronics</h1>
            <p>{selected.label}</p>
          </div>

          <div className="mb-5">
            <h2 className="text-xl md:text-2xl font-bold text-yellow-400 print:text-black">
              {selected.label}
            </h2>
            <p className="text-gray-400 print:text-black text-sm">
              {from || "Start"} to {to || "Today"}
            </p>
          </div>

          <SummaryGrid summary={summary} />

          <div className="mt-6">
            {selected.key === "sales" && <SalesTable rows={rows} />}
            {selected.key === "profit" && <SalesTable rows={rows} />}
            {selected.key === "installments" && <InstallmentTable rows={rows} />}
            {selected.key === "overdue" && <InstallmentTable rows={rows} />}
            {selected.key === "inventory" && <InventoryTable rows={rows} />}
            {selected.key === "partners" && <PartnerTable rows={rows} />}
            {selected.key === "customers" && <CustomerTable rows={rows} />}
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-8 text-center">
          <img src="/logo.png" className="h-20 mx-auto opacity-50 mb-4" />
          <h2 className="text-xl font-bold text-yellow-400">
            Select and load a report
          </h2>
          <p className="text-gray-400 text-sm">
            Choose report type and date range, then click Load Report.
          </p>
        </div>
      )}
    </div>
  );
};

const SummaryGrid = ({ summary }) => {
  const entries = Object.entries(summary || {});

  if (!entries.length) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="bg-black/60 border border-yellow-600/20 rounded-xl p-3 print:bg-white print:border print:border-gray-300"
        >
          <p className="text-gray-400 print:text-gray-600 text-xs capitalize">
            {key.replaceAll(/([A-Z])/g, " $1")}
          </p>
          <h3 className="text-lg font-bold text-yellow-300 print:text-black">
            {typeof value === "number" ? value.toLocaleString() : value}
          </h3>
        </div>
      ))}
    </div>
  );
};

const SalesTable = ({ rows }) => (
  <ResponsiveTable
    headers={["Invoice", "Type", "Customer", "Product", "Final", "Paid", "Remaining", "Profit"]}
    rows={rows.map((s) => [
      s.invoiceNo,
      s.saleType,
      s.customer?.name || "-",
      s.product?.productName || s.productId,
      money(s.finalAmount),
      money(s.paidAmount),
      money(s.remainingAmount),
      money(s.profit),
    ])}
  />
);

const InstallmentTable = ({ rows }) => (
  <ResponsiveTable
    headers={["Customer", "Invoice", "Due Date", "Remaining", "Late Days", "Fine", "Total", "Status"]}
    rows={rows.map((i) => [
      i.customer?.name || i.customerId,
      i.sale?.invoiceNo || i.saleId,
      i.dueDate,
      money(i.remainingAmount),
      i.liveLateDays || 0,
      money(i.liveFineAmount),
      money(i.liveTotalPayable),
      i.status,
    ])}
  />
);

const InventoryTable = ({ rows }) => (
  <ResponsiveTable
    headers={["Product", "Category", "Brand", "Qty", "Purchase", "Sale", "Status"]}
    rows={rows.map((p) => [
      p.productName,
      p.category,
      p.brand || "-",
      p.quantity,
      money(p.purchasePrice),
      money(p.salePrice),
      p.status,
    ])}
  />
);

const PartnerTable = ({ rows }) => (
  <ResponsiveTable
    headers={["Name", "Phone", "Invested", "Withdrawn", "Profit", "Loss", "Balance"]}
    rows={rows.map((p) => [
      p.name,
      p.phone || "-",
      money(p.totalInvested),
      money(p.totalWithdrawn),
      money(p.profitShare),
      money(p.lossShare),
      money(p.currentBalance),
    ])}
  />
);

const CustomerTable = ({ rows }) => (
  <ResponsiveTable
    headers={["Name", "Phone", "CNIC", "Type", "Risk", "Cheque"]}
    rows={rows.map((c) => [
      c.name,
      c.phone,
      c.cnic || "-",
      c.customerType,
      c.riskStatus,
      c.chequeNumber || "-",
    ])}
  />
);

const ResponsiveTable = ({ headers, rows }) => (
  <>
    <div className="hidden md:block overflow-hidden rounded-2xl border border-yellow-600/30 print:block print:border-gray-300">
      <table className="w-full text-sm">
        <thead className="bg-yellow-500 text-black print:bg-gray-200">
          <tr>
            {headers.map((h) => (
              <th key={h} className="p-3 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-t border-yellow-600/20 print:border-gray-300 text-gray-200 print:text-black"
            >
              {row.map((cell, i) => (
                <td key={i} className="p-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="md:hidden space-y-3 print:hidden">
      {rows.map((row, index) => (
        <div
          key={index}
          className="bg-black/60 border border-yellow-600/20 rounded-xl p-4"
        >
          {headers.map((h, i) => (
            <div key={h} className="flex justify-between gap-3 py-1 text-sm">
              <span className="text-gray-500">{h}</span>
              <span className="text-gray-200 text-right">{row[i]}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </>
);

const money = (value) => Number(value || 0).toLocaleString();

export default Reports;