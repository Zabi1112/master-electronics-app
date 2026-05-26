import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const emptyForm = {
  name: "",
  fatherName: "",
  cnic: "",
  phone: "",
  alternatePhone: "",
  address: "",
  jobOrBusiness: "",
  monthlyIncome: 0,

  customerType: "cash",

  reference1Name: "",
  reference1Phone: "",
  reference1Cnic: "",

  reference2Name: "",
  reference2Phone: "",
  reference2Cnic: "",

  chequeNumber: "",

  riskStatus: "normal",
  notes: "",
};

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    customerType: "",
    riskStatus: "",
  });

  const loadCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/customers");
      setCustomers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const text = `${customer.name || ""} ${customer.phone || ""} ${
        customer.cnic || ""
      } ${customer.fatherName || ""}`.toLowerCase();

      const matchesSearch = text.includes(filters.search.toLowerCase());

      const matchesType =
        !filters.customerType ||
        customer.customerType === filters.customerType;

      const matchesRisk =
        !filters.riskStatus || customer.riskStatus === filters.riskStatus;

      return matchesSearch && matchesType && matchesRisk;
    });
  }, [customers, filters]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((old) => ({ ...old, [name]: value }));
  };

  const submitCustomer = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
      } else {
        await api.post("/customers", form);
      }

      setForm(emptyForm);
      setEditingId(null);
      setFormOpen(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Save customer failed");
    }
  };

  const startEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name || "",
      fatherName: customer.fatherName || "",
      cnic: customer.cnic || "",
      phone: customer.phone || "",
      alternatePhone: customer.alternatePhone || "",
      address: customer.address || "",
      jobOrBusiness: customer.jobOrBusiness || "",
      monthlyIncome: customer.monthlyIncome || 0,

      customerType: customer.customerType || "cash",

      reference1Name: customer.reference1Name || "",
      reference1Phone: customer.reference1Phone || "",
      reference1Cnic: customer.reference1Cnic || "",

      reference2Name: customer.reference2Name || "",
      reference2Phone: customer.reference2Phone || "",
      reference2Cnic: customer.reference2Cnic || "",

      chequeNumber: customer.chequeNumber || "",

      riskStatus: customer.riskStatus || "normal",
      notes: customer.notes || "",
    });

    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  };

  const deleteCustomer = async (id) => {
    const ok = window.confirm("Delete this customer?");
    if (!ok) return;

    try {
      await api.delete(`/customers/${id}`);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Delete customer failed");
    }
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Customers
          </h1>
          <p className="text-gray-400 text-sm">
            Manage cash and installment customers.
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
          {formOpen ? "Close" : "+ Add Customer"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card title="Total Customers" value={customers.length} />
        <Card
          title="Installment"
          value={customers.filter((c) => c.customerType === "installment").length}
        />
        <Card
          title="Risky"
          value={customers.filter((c) => c.riskStatus === "risky").length}
        />
        <Card
          title="Blacklisted"
          value={customers.filter((c) => c.riskStatus === "blacklisted").length}
        />
      </div>

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Search name, phone, CNIC..."
            value={filters.search}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value })
            }
          />

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.customerType}
            onChange={(e) =>
              setFilters({ ...filters, customerType: e.target.value })
            }
          >
            <option value="">All Types</option>
            <option value="cash">Cash</option>
            <option value="installment">Installment</option>
          </select>

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.riskStatus}
            onChange={(e) =>
              setFilters({ ...filters, riskStatus: e.target.value })
            }
          >
            <option value="">All Risk</option>
            <option value="good">Good</option>
            <option value="normal">Normal</option>
            <option value="risky">Risky</option>
            <option value="blacklisted">Blacklisted</option>
          </select>

          <button
            onClick={() =>
              setFilters({
                search: "",
                customerType: "",
                riskStatus: "",
              })
            }
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
          onSubmit={submitCustomer}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            {editingId ? "Edit Customer" : "Add Customer"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              name="name"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Customer Name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <input
              name="fatherName"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Father Name"
              value={form.fatherName}
              onChange={handleChange}
            />

            <input
              name="cnic"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Customer CNIC"
              value={form.cnic}
              onChange={handleChange}
            />

            <input
              name="phone"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Phone Number"
              value={form.phone}
              onChange={handleChange}
              required
            />

            <input
              name="alternatePhone"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Alternate Phone"
              value={form.alternatePhone}
              onChange={handleChange}
            />

            <select
              name="customerType"
              className="px-4 py-3 rounded-xl bg-white"
              value={form.customerType}
              onChange={handleChange}
            >
              <option value="cash">Cash Customer</option>
              <option value="installment">Installment Customer</option>
            </select>

            <input
              name="jobOrBusiness"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Job / Business"
              value={form.jobOrBusiness}
              onChange={handleChange}
            />

            <input
              name="monthlyIncome"
              type="number"
              className="px-4 py-3 rounded-xl bg-white"
              placeholder="Monthly Income"
              value={form.monthlyIncome}
              onChange={handleChange}
            />

            <textarea
              name="address"
              className="px-4 py-3 rounded-xl bg-white md:col-span-2"
              placeholder="Address"
              value={form.address}
              onChange={handleChange}
              rows="3"
            />
          </div>

          {form.customerType === "installment" && (
            <>
              <h2 className="text-xl font-bold text-yellow-400 mt-6 mb-4">
                Installment Verification
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  name="reference1Name"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Reference 1 Name"
                  value={form.reference1Name}
                  onChange={handleChange}
                />

                <input
                  name="reference1Phone"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Reference 1 Phone"
                  value={form.reference1Phone}
                  onChange={handleChange}
                />

                <input
                  name="reference1Cnic"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Reference 1 CNIC"
                  value={form.reference1Cnic}
                  onChange={handleChange}
                />

                <input
                  name="reference2Name"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Reference 2 Name"
                  value={form.reference2Name}
                  onChange={handleChange}
                />

                <input
                  name="reference2Phone"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Reference 2 Phone"
                  value={form.reference2Phone}
                  onChange={handleChange}
                />

                <input
                  name="reference2Cnic"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Reference 2 CNIC"
                  value={form.reference2Cnic}
                  onChange={handleChange}
                />

                <input
                  name="chequeNumber"
                  className="px-4 py-3 rounded-xl bg-white"
                  placeholder="Cheque Number Optional"
                  value={form.chequeNumber}
                  onChange={handleChange}
                />

                <select
                  name="riskStatus"
                  className="px-4 py-3 rounded-xl bg-white"
                  value={form.riskStatus}
                  onChange={handleChange}
                >
                  <option value="good">Good</option>
                  <option value="normal">Normal</option>
                  <option value="risky">Risky</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </div>
            </>
          )}

          {form.customerType === "cash" && (
            <div className="mt-4">
              <select
                name="riskStatus"
                className="px-4 py-3 rounded-xl bg-white w-full"
                value={form.riskStatus}
                onChange={handleChange}
              >
                <option value="good">Good</option>
                <option value="normal">Normal</option>
                <option value="risky">Risky</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
          )}

          <textarea
            name="notes"
            className="px-4 py-3 rounded-xl bg-white w-full mt-4"
            placeholder="Notes"
            value={form.notes}
            onChange={handleChange}
            rows="3"
          />

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
              {editingId ? "Update Customer" : "Save Customer"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading customers...</p>
      ) : (
        <>
          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">CNIC</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Risk</th>
                  <th className="p-3 text-left">Cheque</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">
                      <div className="font-semibold text-yellow-300">
                        {customer.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {customer.fatherName || "-"}
                      </div>
                    </td>
                    <td className="p-3">{customer.phone}</td>
                    <td className="p-3">{customer.cnic || "-"}</td>
                    <td className="p-3 capitalize">{customer.customerType}</td>
                    <td className="p-3 capitalize">{customer.riskStatus}</td>
                    <td className="p-3">{customer.chequeNumber || "-"}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => startEdit(customer)}
                        className="bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold mr-2"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteCustomer(customer.id)}
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
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">
                      {customer.name}
                    </h3>
                    <p className="text-sm text-gray-400">{customer.phone}</p>
                  </div>

                  <span className="h-fit px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs capitalize">
                    {customer.customerType}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Info label="CNIC" value={customer.cnic || "-"} />
                  <Info label="Risk" value={customer.riskStatus || "-"} />
                  <Info label="Father" value={customer.fatherName || "-"} />
                  <Info label="Cheque" value={customer.chequeNumber || "-"} />
                </div>

                {customer.customerType === "installment" && (
                  <div className="mt-4 border-t border-yellow-600/20 pt-3 text-sm">
                    <p className="text-yellow-400 font-semibold mb-2">
                      References
                    </p>
                    <p className="text-gray-300">
                      {customer.reference1Name || "-"} /{" "}
                      {customer.reference1Phone || "-"}
                    </p>
                    <p className="text-gray-300">
                      {customer.reference2Name || "-"} /{" "}
                      {customer.reference2Phone || "-"}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => startEdit(customer)}
                    className="bg-yellow-500 text-black py-3 rounded-xl font-bold"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteCustomer(customer.id)}
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
    <h2 className="text-xl md:text-2xl font-bold text-yellow-400">{value}</h2>
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold capitalize">{value}</p>
  </div>
);

export default Customers;