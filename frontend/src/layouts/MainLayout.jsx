import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserRound,
  Package,
  ShoppingCart,
  CalendarClock,
  HandCoins,
  BarChart3,
  Settings,
  ReceiptText,
  LogOut,
  History,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Users", path: "/users", icon: Users },
  { label: "Expenses", path: "/expenses", icon: ReceiptText },
  { label: "Customers", path: "/customers", icon: UserRound },
  { label: "Inventory", path: "/inventory", icon: Package },
  { label: "Sales", path: "/sales", icon: ShoppingCart },
  { label: "Installments", path: "/installments", icon: CalendarClock },
  { label: "Partners", path: "/partners", icon: HandCoins },
  { label: "History", path: "/history", icon: History },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "Finance", path: "/finance", icon: Settings },
];

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      <aside className="hidden md:flex w-72 bg-black/80 border-r border-yellow-600/30 p-5 flex-col">
        <div className="text-center mb-8">
          <img src="/logo.png" className="h-20 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-yellow-400">Master Electronics</h1>
          <p className="text-xs text-gray-400">{user?.role}</p>
        </div>

        <nav className="space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                    isActive
                      ? "bg-yellow-500 text-black font-semibold"
                      : "text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-400"
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-600 py-3 rounded-xl"
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;