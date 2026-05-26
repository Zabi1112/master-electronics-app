import { useEffect, useState } from "react";
import api from "../api/api";

const modules = [
  "users",
  "customers",
  "products",
  "sales",
  "installments",
  "partners",
  "expenses",
  "finance",
];

const actions = ["create", "update", "delete", "pay", "login"];

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    module: "",
    action: "",
    from: "",
    to: "",
    limit: 100,
  });

  const loadLogs = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (filters.module) params.append("module", filters.module);
      if (filters.action) params.append("action", filters.action);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.limit) params.append("limit", filters.limit);

      const res = await api.get(`/activity-logs?${params.toString()}`);
      setLogs(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const resetFilters = () => {
    setFilters({
      module: "",
      action: "",
      from: "",
      to: "",
      limit: 100,
    });

    setTimeout(loadLogs, 100);
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">
          Activity Logs
        </h1>
        <p className="text-gray-400 text-sm">
          Track who created, updated, deleted, or changed important business data.
        </p>
      </div>

      <div className="bg-black/70 border border-yellow-600/30 rounded-2xl p-4 md:p-5 mb-6">
        <h2 className="text-lg font-bold text-yellow-400 mb-4">
          Filters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.module}
            onChange={(e) =>
              setFilters({ ...filters, module: e.target.value })
            }
          >
            <option value="">All Modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-3 rounded-xl bg-white"
            value={filters.action}
            onChange={(e) =>
              setFilters({ ...filters, action: e.target.value })
            }
          >
            <option value="">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.toUpperCase()}
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

          <input
            type="number"
            className="px-4 py-3 rounded-xl bg-white"
            placeholder="Limit"
            value={filters.limit}
            onChange={(e) =>
              setFilters({ ...filters, limit: e.target.value })
            }
          />

          <button
            onClick={loadLogs}
            className="bg-yellow-500 text-black font-bold rounded-xl py-3"
          >
            Apply
          </button>
        </div>

        <button
          onClick={resetFilters}
          className="mt-3 w-full md:w-auto bg-gray-700 text-white font-bold px-5 py-3 rounded-xl"
        >
          Reset Filters
        </button>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-yellow-400">Loading activity logs...</p>
      ) : (
        <>
          <div className="hidden lg:block bg-black/70 border border-yellow-600/30 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-yellow-500 text-black">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Module</th>
                  <th className="p-3 text-left">Action</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-yellow-600/20 text-gray-200"
                  >
                    <td className="p-3 text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-yellow-300">
                        {log.user?.name || "System"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {log.user?.role || "-"}
                      </div>
                    </td>

                    <td className="p-3 capitalize">{log.module}</td>

                    <td className="p-3">
                      <ActionBadge action={log.action} />
                    </td>

                    <td className="p-3 text-sm">
                      {log.description || "-"}
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-black/75 border border-yellow-600/30 rounded-2xl p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-yellow-400 capitalize">
                      {log.module}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <ActionBadge action={log.action} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <Info label="User" value={log.user?.name || "System"} />
                  <Info label="Role" value={log.user?.role || "-"} />
                  <Info label="Record ID" value={log.recordId || "-"} />
                  <Info label="IP" value={log.ipAddress || "-"} />
                </div>

                <p className="text-gray-300 text-sm mt-4">
                  {log.description || "-"}
                </p>

                <button
                  onClick={() => setSelectedLog(log)}
                  className="mt-4 w-full bg-yellow-500 text-black py-3 rounded-xl font-bold"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto bg-[#0b0b0b] border border-yellow-600/40 rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-yellow-400">
                  Activity Details
                </h2>
                <p className="text-gray-400 text-sm">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="bg-gray-700 text-white px-4 py-2 rounded-xl font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Mini title="User" value={selectedLog.user?.name || "System"} />
              <Mini title="Module" value={selectedLog.module} />
              <Mini title="Action" value={selectedLog.action} />
              <Mini title="Record ID" value={selectedLog.recordId || "-"} />
            </div>

            <div className="bg-black/50 border border-yellow-600/20 rounded-xl p-4 mb-4">
              <p className="text-gray-500 text-xs">Description</p>
              <p className="text-gray-200">{selectedLog.description || "-"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DataBox title="Old Data" data={selectedLog.oldData} />
              <DataBox title="New Data" data={selectedLog.newData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionBadge = ({ action }) => {
  const colors = {
    create: "bg-green-600/20 text-green-300",
    update: "bg-blue-600/20 text-blue-300",
    delete: "bg-red-600/20 text-red-300",
    pay: "bg-yellow-600/20 text-yellow-300",
    login: "bg-purple-600/20 text-purple-300",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs uppercase ${
        colors[action] || "bg-gray-600/20 text-gray-300"
      }`}
    >
      {action}
    </span>
  );
};

const Info = ({ label, value }) => (
  <div>
    <p className="text-gray-500 text-xs">{label}</p>
    <p className="text-gray-200 font-semibold capitalize">{value}</p>
  </div>
);

const Mini = ({ title, value }) => (
  <div className="bg-black/50 border border-yellow-600/20 rounded-xl p-3">
    <p className="text-gray-500 text-xs">{title}</p>
    <h3 className="text-yellow-300 font-bold capitalize">{value}</h3>
  </div>
);

const DataBox = ({ title, data }) => (
  <div className="bg-black/50 border border-yellow-600/20 rounded-xl p-4">
    <h3 className="text-yellow-400 font-bold mb-3">{title}</h3>

    {data ? (
      <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-80">
        {JSON.stringify(data, null, 2)}
      </pre>
    ) : (
      <p className="text-gray-500 text-sm">No data</p>
    )}
  </div>
);

export default ActivityLogs;