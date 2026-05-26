import { createContext, useContext, useState } from "react";
import api from "../api/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("master_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });

    localStorage.setItem("master_token", res.data.token);
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("master_user", JSON.stringify(res.data.user));
    setUser(res.data.user);

    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("master_token");
    localStorage.removeItem("master_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);