import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
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
  Menu,
  X,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
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

      {/* Mobile Header with Hamburger Menu */}
      <div className="md:hidden flex items-center justify-between bg-black/80 border-b border-yellow-600/30 p-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="h-10" />
          <h1 className="text-sm font-bold text-yellow-400">Master Electronics</h1>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="p-2 hover:bg-yellow-500/20 rounded-lg transition"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={closeMobileMenu}>
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-black/90 border-r border-yellow-600/30 p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold text-yellow-400">Master Electronics</h1>
              <p className="text-xs text-gray-400 mt-2">{user?.role}</p>
            </div>

            <nav className="space-y-2 mb-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileMenu}
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
              onClick={() => {
                handleLogout();
                closeMobileMenu();
              }}
              className="w-full flex items-center justify-center gap-2 bg-red-600/90 hover:bg-red-600 py-3 rounded-xl"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 border-t border-yellow-600/30 flex overflow-x-auto">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-2 flex-1 text-xs transition ${
                  isActive
                    ? "bg-yellow-500 text-black font-semibold"
                    : "text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-400"
                }`
              }
            >
              <Icon size={20} />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          );
        })}
        <button
          onClick={toggleMobileMenu}
          className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-400 flex-1 text-xs transition"
        >
          <Menu size={20} />
          <span className="hidden sm:inline">More</span>
        </button>
      </nav>
    </div>
  );
};

export default MainLayout;