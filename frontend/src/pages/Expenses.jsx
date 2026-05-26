import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const money = (v) => Number(v || 0).toLocaleString();

const emptyForm = {
  title: "",
  category: "misc",
  amount: "",
  expenseDate: new Date().toISOString().split("T")[0],
  paymentMethod: "cash",
  notes: "",
};

const categories = [
  "rent",
  "salary",
  "guest",
  "utility",
  "transport",
  "maintenance",
  "marketing",
  "donation",
  "misc",
];

const paymentMethods = ["cash", "bank", "easypaisa", "jazzcash", "other"];

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    category: "",
    paymentMethod: "",
    month: new Date().toISOString().slice(0, 7),
  });

  const loadExpenses = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.category) params.append("category", filters.category);
      if (filters.paymentMethod)
        params.append("paymentMethod", filters.paymentMethod);

      const [expensesRes, summaryRes] = await Promise.all([
        api.get(`/expenses?${params.toString()}`),
        api.get("/expenses/summary"),
      ]);

      setExpenses(expensesRes.data.expenses || []);
      setSummary(summaryRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.append("month", filters.month);

      if (filters.category) params.append("category", filters.category);
      if (filters.paymentMethod)
        params.append("paymentMethod", filters.paymentMethod);

      const res = await api.get(`/expenses/reports/monthly?${params.toString()}`);
      setExpenses(res.data.expenses || []);
      setSummary({
        totalExpenses: res.data.totalAmount,
        monthlyExpenses: res.data.totalAmount,
        todayExpenses: summary?.todayExpenses || 0,
        byCategory: res.data.byCategory || [],
      });
    } catch (err) {
      setError(err.response?.data?.message || "Monthly report failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const visibleTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        amount: Number(form.amount || 0),
      };

      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
      } else {
        await api.post("/expenses", payload);
      }

      setForm(emptyForm);
      setEditingId(null);
      setFormOpen(false);
      loadExpenses();
    } catch (err) {
      setError(err.response?.data?.message || "Save expense failed");
    }
  };

  const startEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      title: expense.title || "",
      category: expense.category || "misc",
      amount: expense.amount || "",
      expenseDate:
        expense.expenseDate || new Date().toISOString().split("T")[0],
      paymentMethod: expense.paymentMethod || "cash",
      notes: expense.notes || "",
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  };

  const deleteExpense = async (id) => {
    const ok = window.confirm("Delete this expense?");
    if (!ok) return;

    try {
      await api.delete(`/expenses/${id}`);
      loadExpenses();
    } catch (err) {
      setError(err.response?.data?.message || "Delete expense failed");
    }
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Daily Expenses
          </h1>
          <p className="text-gray-400 text-sm">
            Add rent, salary, guest, utility, marketing and other business expenses.
          </p>
        </div>

        <button
          onClick={() => {
            setFormOpen(!formOpen);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add Expense"}
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 mb-6">
        <Card title="All Expenses" value={summary?.totalExpenses} />
        <Card title="This Month" value={summary?.monthlyExpenses} />
        <Card title="Today" value={summary?.todayExpenses} />
        <Card title="Visible Total" value={visibleTotal} />
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            {editingId ? "Edit Expense" : "Add Expense"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <input
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Expense Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />

            <select
              className="px-4 py-3 rounded-xl bg-white"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>

            <input
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />

            <input
              type="date"
              className="px-4 py-3 rounded-xl bg-white"
              value={form.expenseDate}
              onChange={(e) =>
                setForm({ ...form, expenseDate: e.target.value })
              }
            />

            <select
              className="px-4 py-3 rounded-xl bg-white"
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
            >
              {paymentMethods.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>

            <textarea
              className="px-4 py-3 rounded-xl bg-white md:col-span-2 xl:col-span-3"
              placeholder="Notes"
              rows="3"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              {editingId ? "Update Expense" : "Save Expense"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">
          Filters & Monthly Report
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
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

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.paymentMethod}
            onChange={(e) =>
              setFilters({ ...filters, paymentMethod: e.target.value })
            }
          >
            <option value="">All Payment</option>
            {paymentMethods.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            onClick={loadExpenses}
            className="bg-yellow-500 text-black font-bold rounded-xl py-3"
          >
            Apply Filter
          </button>

          <button
            onClick={() => {
              setFilters({
                from: "",
                to: "",
                category: "",
                paymentMethod: "",
                month: new Date().toISOString().slice(0, 7),
              });
              setTimeout(loadExpenses, 100);
            }}
            className="bg-gray-700 text-white font-bold rounded-xl py-3"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <input
            type="month"
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
          />

          <button
            onClick={loadMonthlyReport}
            className="bg-green-500 text-black font-bold rounded-xl py-3 md:col-span-2"
          >
            Load Monthly Expense Report
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-yellow-400">Loading expenses...</p>
      ) : (
        <>
          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Payment</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">{expense.expenseDate}</td>
                    <td className="p-3">
                      <div className="font-semibold text-yellow-300">
                        {expense.title}
                      </div>
                      <div className="text-xs text-gray-400">
                        {expense.notes || "-"}
                      </div>
                    </td>
                    <td className="p-3 capitalize">{expense.category}</td>
                    <td className="p-3 capitalize">{expense.paymentMethod}</td>
                    <td className="p-3 text-right font-bold">
                      Rs. {money(expense.amount)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => startEdit(expense)}
                        className="bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">
                      {expense.title}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {expense.expenseDate}
                    </p>
                  </div>

                  <strong className="text-red-300">
                    Rs. {money(expense.amount)}
                  </strong>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <Info label="Category" value={expense.category} />
                  <Info label="Payment" value={expense.paymentMethod} />
                  <Info
                    label="Created By"
                    value={expense.createdUser?.name || "-"}
                  />
                  <Info label="Notes" value={expense.notes || "-"} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => startEdit(expense)}
                    className="bg-yellow-500 text-black py-3 rounded-xl font-bold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteExpense(expense.id)}
                    className="bg-red-600 text-white py-3 rounded-xl font-bold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Card = ({ title, value }) => (
  <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4">
    <p className="text-gray-400 text-xs">{title}</p>
    <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
      Rs. {money(value)}
    </h2>
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold capitalize">{value}</p>
  </div>
);

export default Expenses;