import { useEffect, useMemo, useState } from "react";
import api from "../api/api";

const roles = ["admin", "manager", "salesman", "accounts"];

const emptyForm = {
  name: "",
  username: "",
  password: "",
  role: "salesman",
  isActive: true,
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    role: "",
    status: "",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");

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

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.name || ""} ${user.username || ""} ${
        user.role || ""
      }`.toLowerCase();

      const matchesSearch = text.includes(filters.search.toLowerCase());
      const matchesRole = !filters.role || user.role === filters.role;
      const matchesStatus =
        !filters.status ||
        (filters.status === "active" && user.isActive) ||
        (filters.status === "inactive" && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, filters]);

  const submitUser = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (editingId) {
        const payload = {
          name: form.name,
          username: form.username,
          role: form.role,
          isActive: form.isActive,
        };

        await api.put(`/users/${editingId}`, payload);
      } else {
        await api.post("/users", form);
      }

      setForm(emptyForm);
      setEditingId(null);
      setFormOpen(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Save user failed");
    }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setForm({
      name: user.name || "",
      username: user.username || "",
      password: "",
      role: user.role || "salesman",
      isActive: Boolean(user.isActive),
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, {
        isActive: !user.isActive,
      });

      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Status update failed");
    }
  };

  const deleteUser = async (user) => {
    if (user.role === "admin") {
      setError("Admin user cannot be deleted from here.");
      return;
    }

    const ok = window.confirm(`Delete user ${user.name}?`);
    if (!ok) return;

    try {
      await api.delete(`/users/${user.id}`);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Delete user failed");
    }
  };

  const submitResetPassword = async (e) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 4) {
      setError("Password should be at least 4 characters");
      return;
    }

    try {
      await api.put(`/users/${resetUser.id}/reset-password`, {
        password: newPassword,
      });

      setResetUser(null);
      setNewPassword("");
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Reset password failed");
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
            Manage staff login, roles, password and access.
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
          {formOpen ? "Close" : "+ Add User"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card title="Total Users" value={users.length} />
        <Card
          title="Active"
          value={users.filter((u) => u.isActive).length}
        />
        <Card
          title="Inactive"
          value={users.filter((u) => !u.isActive).length}
        />
        <Card
          title="Salesmen"
          value={users.filter((u) => u.role === "salesman").length}
        />
      </div>

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Search name / username..."
            value={filters.search}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value })
            }
          />

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={() =>
              setFilters({
                search: "",
                role: "",
                status: "",
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
          onSubmit={submitUser}
          className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-6 mb-6"
        >
          <h2 className="text-xl font-bold text-yellow-400 mb-4">
            {editingId ? "Edit User" : "Add User"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {!editingId && (
              <input
                className="px-4 py-3 rounded-xl bg-white"
                placeholder="Password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
              />
            )}

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

            <label className="flex items-center gap-3 text-gray-300 bg-black/40 border border-yellow-600/20 rounded-xl px-4 py-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active User
            </label>
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
              {editingId ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading users...</p>
      ) : (
        <>
          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Username</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3 font-semibold text-yellow-300">
                      {user.name}
                    </td>
                    <td className="p-3">{user.username}</td>
                    <td className="p-3 capitalize">{user.role}</td>
                    <td className="p-3">
                      <Status active={user.isActive} />
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => startEdit(user)}
                        className="bg-yellow-500 text-black px-3 py-2 rounded-lg font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setResetUser(user)}
                        className="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold"
                      >
                        Password
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={user.role === "admin"}
                        className="bg-gray-700 text-white px-3 py-2 rounded-lg font-bold disabled:opacity-40"
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        disabled={user.role === "admin"}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold disabled:opacity-40"
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
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400">{user.name}</h3>
                    <p className="text-sm text-gray-400">{user.username}</p>
                  </div>
                  <Status active={user.isActive} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <Info label="Role" value={user.role} />
                  <Info label="User ID" value={user.id} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => startEdit(user)}
                    className="bg-yellow-500 text-black py-3 rounded-xl font-bold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setResetUser(user)}
                    className="bg-blue-600 text-white py-3 rounded-xl font-bold"
                  >
                    Password
                  </button>
                  <button
                    onClick={() => toggleActive(user)}
                    disabled={user.role === "admin"}
                    className="bg-gray-700 text-white py-3 rounded-xl font-bold disabled:opacity-40"
                  >
                    {user.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    disabled={user.role === "admin"}
                    className="bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {resetUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end md:items-center justify-center p-4">
          <form
            onSubmit={submitResetPassword}
            className="w-full max-w-md bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5"
          >
            <h2 className="text-xl font-bold text-yellow-400 mb-2">
              Reset Password
            </h2>
            <p className="text-gray-400 text-sm mb-5">
              User: {resetUser.name}
            </p>

            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl bg-white mb-4"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setResetUser(null);
                  setNewPassword("");
                }}
                className="bg-gray-700 text-white py-3 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button className="bg-yellow-500 text-black py-3 rounded-xl font-bold">
                Save
              </button>
            </div>
          </form>
        </div>
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

const Status = ({ active }) => (
  <span
    className={`px-3 py-1 rounded-full text-xs ${
      active ? "bg-green-600/20 text-green-300" : "bg-red-600/20 text-red-300"
    }`}
  >
    {active ? "Active" : "Inactive"}
  </span>
);

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold capitalize">{value}</p>
  </div>
);

export default Users;