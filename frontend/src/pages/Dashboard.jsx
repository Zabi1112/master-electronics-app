import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarClock,
  CreditCard,
  HandCoins,
  PackageX,
  RefreshCcw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/api";

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

const cardAnim = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [statsRes, salesRes, productsRes, overdueRes] = await Promise.all([
        api.get("/dashboard/stats"),
        api.get("/sales"),
        api.get("/products"),
        api.get("/installments/overdue"),
      ]);

      setStats(statsRes.data);
      setSales(salesRes.data || []);
      setProducts(productsRes.data || []);
      setOverdue(overdueRes.data || []);
    } catch (error) {
      console.log("Dashboard load error:", error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const salesChart = useMemo(() => {
    const map = {};

    sales.forEach((sale) => {
      const date = new Date(sale.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      if (!map[date]) {
        map[date] = { date, cash: 0, installment: 0 };
      }

      if (sale.saleType === "cash") {
        map[date].cash += Number(sale.finalAmount || 0);
      } else {
        map[date].installment += Number(sale.finalAmount || 0);
      }
    });

    return Object.values(map).slice(-7);
  }, [sales]);

  const inventoryChart = useMemo(() => {
    const inStock = products.filter(
      (p) => p.status === "in_stock" && Number(p.quantity || 0) > 0
    ).length;

    const lowStock = products.filter(
      (p) =>
        Number(p.quantity || 0) > 0 &&
        Number(p.quantity || 0) <= Number(p.lowStockAlertQty || 1)
    ).length;

    const outStock = products.filter(
      (p) => Number(p.quantity || 0) <= 0 || p.status === "sold"
    ).length;

    return [
      { name: "In Stock", value: inStock },
      { name: "Low Stock", value: lowStock },
      { name: "Out Stock", value: outStock },
    ];
  }, [products]);

  const installmentChart = useMemo(() => {
    const pending = Number(stats?.installments?.pendingInstallmentAmount || 0);
    const overdueAmount = Number(stats?.installments?.overdueAmount || 0);
    const recovered = Number(stats?.installments?.recoveredInstallments || 0);

    return [
      { name: "Recovered", value: recovered },
      { name: "Pending", value: pending },
      { name: "Overdue", value: overdueAmount },
    ];
  }, [stats]);

  const lowStockItems = products
    .filter(
      (p) =>
        Number(p.quantity || 0) <= Number(p.lowStockAlertQty || 1) ||
        Number(p.quantity || 0) <= 0
    )
    .slice(0, 5);

  const topDueCustomers = overdue.slice(0, 5);

  if (!stats) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <img src="/logo.png" className="h-28 mx-auto mb-4 animate-pulse" />
          <p className="text-yellow-400 font-bold">Loading Dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-black text-white"
          >
            Dashboard
          </motion.h1>
          <p className="text-gray-400 mt-1">
            Welcome back, Admin 👋
          </p>
        </div>

        <button
          onClick={loadDashboard}
          className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-3 rounded-xl"
        >
          <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.08 }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-5"
      >
        <MainCard
          icon={TrendingUp}
          title="Total Sales"
          value={formatMoney(stats.sales?.totalSales)}
          glow="green"
        />
        <MainCard
          icon={CreditCard}
          title="Cash Sales"
          value={formatMoney(stats.sales?.cashSales)}
          glow="blue"
        />
        <MainCard
          icon={CalendarClock}
          title="Installment Sales"
          value={formatMoney(stats.sales?.installmentSales)}
          glow="purple"
        />
        <MainCard
          icon={HandCoins}
          title="Total Profit"
          value={formatMoney(stats.sales?.totalProfit)}
          glow="green"
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <AnimatedPanel className="xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Sales Overview</h2>
            <span className="text-xs text-yellow-300 bg-yellow-500/10 px-3 py-1 rounded-full">
              Last Activity
            </span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChart}>
                <defs>
                  <linearGradient id="cash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#facc15" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="installment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis dataKey="date" stroke="#777" />
                <YAxis stroke="#777" />
                <Tooltip
                  contentStyle={{
                    background: "#090909",
                    border: "1px solid rgba(250,204,21,0.3)",
                    borderRadius: 14,
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cash"
                  stroke="#facc15"
                  strokeWidth={3}
                  fill="url(#cash)"
                />
                <Area
                  type="monotone"
                  dataKey="installment"
                  stroke="#a855f7"
                  strokeWidth={3}
                  fill="url(#installment)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AnimatedPanel>

        <AnimatedPanel>
          <h2 className="text-xl font-bold text-white mb-4">
            Installment Status
          </h2>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={installmentChart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                >
                  {installmentChart.map((_, index) => (
                    <Cell
                      key={index}
                      fill={["#22c55e", "#facc15", "#ef4444"][index]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#090909",
                    border: "1px solid rgba(250,204,21,0.3)",
                    borderRadius: 14,
                    color: "#fff",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AnimatedPanel>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.06 }}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-5"
      >
        <MiniCard icon={Banknote} title="Total Invested" value={formatMoney(stats.sales?.totalInvested)} />
        <MiniCard icon={Wallet} title="Total Regained" value={formatMoney(stats.sales?.totalRegained)} />
        <MiniCard icon={ArrowUpRight} title="Profit Recovered" value={formatMoney(stats.sales?.profitRecovered)} />
        <MiniCard icon={HandCoins} title="Profit Pending" value={formatMoney(stats.sales?.profitPending)} danger />
        <MiniCard icon={CalendarClock} title="Overdue Amount" value={formatMoney(stats.installments?.overdueAmount)} danger />
        <MiniCard icon={Users} title="Overdue Count" value={stats.installments?.overdueInstallmentsCount || 0} danger />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <AnimatedPanel>
          <h2 className="text-xl font-bold text-white mb-4">Recent Sales</h2>
          <div className="space-y-3">
            {sales.slice(0, 5).map((sale) => (
              <ListRow
                key={sale.id}
                title={sale.invoiceNo}
                subtitle={sale.customer?.name || sale.saleType}
                value={formatMoney(sale.finalAmount)}
                badge={sale.saleType}
              />
            ))}
          </div>
        </AnimatedPanel>

        <AnimatedPanel>
          <h2 className="text-xl font-bold text-white mb-4">Low Stock Alert</h2>
          <div className="space-y-3">
            {lowStockItems.map((p) => (
              <ListRow
                key={p.id}
                title={p.productName}
                subtitle={`Stock: ${p.quantity} | Min: ${p.lowStockAlertQty || 1}`}
                value={p.quantity <= 0 ? "Out" : "Low"}
                badge={p.quantity <= 0 ? "out" : "low"}
              />
            ))}
          </div>
        </AnimatedPanel>

        <AnimatedPanel>
          <h2 className="text-xl font-bold text-white mb-4">Top Due Customers</h2>
          <div className="space-y-3">
            {topDueCustomers.map((item) => (
              <ListRow
                key={item.id}
                title={item.customer?.name || `Customer #${item.customerId}`}
                subtitle={`Due: ${item.dueDate} | Late: ${item.liveLateDays || 0} days`}
                value={formatMoney(item.liveTotalPayable || item.remainingAmount)}
                badge="due"
              />
            ))}
          </div>
        </AnimatedPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <GlowBox
          icon={Boxes}
          title="Inventory Value"
          value={formatMoney(stats.inventory?.inventoryValue)}
          color="yellow"
        />
        <GlowBox
          icon={PackageX}
          title="Total Products"
          value={stats.inventory?.totalProducts || 0}
          color="blue"
        />
        <GlowBox
          icon={HandCoins}
          title="Partner Investment"
          value={formatMoney(stats.partners?.totalPartnerInvestment)}
          color="green"
        />
        <GlowBox
          icon={Wallet}
          title="Partner Balance"
          value={formatMoney(stats.partners?.totalPartnerBalance)}
          color="purple"
        />
      </div>
    </div>
  );
};

const MainCard = ({ icon: Icon, title, value, glow }) => (
  <motion.div
    variants={cardAnim}
    transition={{ duration: 0.45 }}
    whileHover={{ y: -5, scale: 1.02 }}
    className="relative overflow-hidden bg-[#0b0b0b]/90 border border-yellow-600/25 rounded-3xl p-5 shadow-xl"
  >
    <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl ${
      glow === "green" ? "bg-green-500/20" :
      glow === "blue" ? "bg-blue-500/20" :
      glow === "purple" ? "bg-purple-500/20" :
      "bg-yellow-500/20"
    }`} />

    <div className="flex items-center gap-4">
      <div className="h-14 w-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-400">
        <Icon size={26} />
      </div>
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <h2 className="text-2xl font-black text-white mt-1">{value}</h2>
      </div>
    </div>

    <div className="mt-5 h-1 rounded-full bg-yellow-500/20 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "72%" }}
        transition={{ delay: 0.3, duration: 0.9 }}
        className="h-full bg-yellow-400"
      />
    </div>
  </motion.div>
);

const AnimatedPanel = ({ children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 25 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45 }}
    className={`bg-[#0b0b0b]/90 border border-yellow-600/25 rounded-3xl p-5 shadow-xl ${className}`}
  >
    {children}
  </motion.div>
);

const MiniCard = ({ icon: Icon, title, value, danger }) => (
  <motion.div
    variants={cardAnim}
    whileHover={{ y: -4 }}
    className="bg-[#0b0b0b]/90 border border-yellow-600/25 rounded-2xl p-4"
  >
    <div className="flex items-center gap-3">
      <div
        className={`h-11 w-11 rounded-xl flex items-center justify-center ${
          danger
            ? "bg-red-500/10 text-red-400"
            : "bg-yellow-500/10 text-yellow-400"
        }`}
      >
        <Icon size={20} />
      </div>

      <div>
        <p className="text-gray-400 text-xs">{title}</p>
        <h3 className="text-lg font-bold text-white">{value}</h3>
      </div>
    </div>
  </motion.div>
);

const ListRow = ({ title, subtitle, value, badge }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center justify-between gap-3 bg-black/40 border border-yellow-600/10 rounded-2xl p-3"
  >
    <div>
      <h3 className="font-bold text-white">{title}</h3>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>

    <div className="text-right">
      <p className="text-yellow-300 font-bold">{value}</p>
      <span className="text-[10px] uppercase bg-yellow-500/10 text-yellow-300 px-2 py-1 rounded-full">
        {badge}
      </span>
    </div>
  </motion.div>
);

const GlowBox = ({ icon: Icon, title, value, color }) => {
  const colors = {
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    green: "bg-green-500/20 text-green-300 border-green-500/30",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      className={`rounded-3xl p-6 border ${colors[color]} bg-[#0b0b0b]/90`}
    >
      <Icon size={34} />
      <p className="text-gray-300 text-sm mt-4">{title}</p>
      <h2 className="text-2xl font-black text-white mt-1">{value}</h2>
    </motion.div>
  );
};

export default Dashboard;