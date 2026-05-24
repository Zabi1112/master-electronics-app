import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4">
      <div className="w-full max-w-md bg-black/80 border border-yellow-600/40 rounded-3xl p-8 shadow-2xl">
        <img src="/logo.png" className="h-28 mx-auto mb-5" />

        <h1 className="text-3xl font-bold text-center text-yellow-400">
          Master Electronics
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Shop Management Login
        </p>

        {error && (
          <div className="bg-red-600/20 text-red-300 p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <input
            className="w-full px-4 py-3 rounded-xl bg-white"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            className="w-full px-4 py-3 rounded-xl bg-white"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;