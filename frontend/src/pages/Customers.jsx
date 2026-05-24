import { useEffect, useState } from "react";
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
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((old) => ({ ...old, [name]: value }));
  };

  const createCustomer = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/customers", form);
      setForm(emptyForm);
      setFormOpen(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Create customer failed");
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
          onClick={() => setFormOpen(!formOpen)}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add Customer"}
        </button>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={createCustomer}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            Customer Details
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

          <textarea
            name="notes"
            className="px-4 py-3 rounded-xl bg-white w-full mt-4"
            placeholder="Notes"
            value={form.notes}
            onChange={handleChange}
            rows="3"
          />

          <button className="mt-5 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Save Customer
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading customers...</p>
      ) : (
        <>
          <div className="hidden md:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">CNIC</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Risk</th>
                  <th className="p-3 text-left">Cheque</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-xs text-gray-400">
                        {customer.fatherName}
                      </div>
                    </td>
                    <td className="p-3">{customer.phone}</td>
                    <td className="p-3">{customer.cnic || "-"}</td>
                    <td className="p-3 capitalize">{customer.customerType}</td>
                    <td className="p-3 capitalize">{customer.riskStatus}</td>
                    <td className="p-3">{customer.chequeNumber || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">
                      {customer.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {customer.phone}
                    </p>
                  </div>

                  <span className="h-fit px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-xs capitalize">
                    {customer.customerType}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">CNIC</p>
                    <p>{customer.cnic || "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Risk</p>
                    <p className="capitalize">{customer.riskStatus}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Father</p>
                    <p>{customer.fatherName || "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Cheque</p>
                    <p>{customer.chequeNumber || "-"}</p>
                  </div>
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Customers;