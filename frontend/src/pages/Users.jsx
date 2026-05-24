import { useEffect, useState } from "react";
import api from "../api/api";

const roles = ["admin", "manager", "salesman", "accounts"];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "salesman",
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/users", form);
      setForm({
        name: "",
        username: "",
        password: "",
        role: "salesman",
      });
      setFormOpen(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Create user failed");
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, {
        isActive: !user.isActive,
      });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Update failed");
    }
  };

  const updateRole = async (user, role) => {
    try {
      await api.put(`/users/${user.id}`, { role });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Role update failed");
    }
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
            Users Management
          </h1>
          <p className="text-gray-400 text-sm">
            Manage staff login, roles, and access.
          </p>
        </div>

        <button
          onClick={() => setFormOpen(!formOpen)}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl w-full sm:w-auto"
        >
          {formOpen ? "Close" : "+ Add User"}
        </button>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={createUser}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />

          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>

          <button className="md:col-span-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Create User
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading users...</p>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Username</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.username}</td>
                    <td className="p-3">
                      <select
                        className="px-3 py-2 rounded-lg bg-white text-black"
                        value={user.role}
                        onChange={(e) => updateRole(user, e.target.value)}
                        disabled={user.role === "admin"}
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          user.isActive
                            ? "bg-green-600/20 text-green-300"
                            : "bg-red-600/20 text-red-300"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={user.role === "admin"}
                        className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold disabled:opacity-40"
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">{user.name}</h3>
                    <p className="text-gray-400 text-sm">{user.username}</p>
                  </div>

                  <span
                    className={`h-fit px-3 py-1 rounded-full text-xs ${
                      user.isActive
                        ? "bg-green-600/20 text-green-300"
                        : "bg-red-600/20 text-red-300"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <select
                    className="px-3 py-3 rounded-xl bg-white text-black w-full"
                    value={user.role}
                    onChange={(e) => updateRole(user, e.target.value)}
                    disabled={user.role === "admin"}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => toggleActive(user)}
                    disabled={user.role === "admin"}
                    className="bg-yellow-500 text-black px-4 py-3 rounded-xl font-bold disabled:opacity-40"
                  >
                    {user.isActive ? "Disable User" : "Enable User"}
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

export default Users;