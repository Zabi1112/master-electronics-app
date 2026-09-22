import { Capacitor } from "@capacitor/core";
import { resolveApiBaseUrl } from "./baseUrl";
import { requireJsonResponse } from "./responseValidation";
import axios from "axios";
import { startRequest, endRequest } from "../store/loadingStore";

const API_BASE_URL = resolveApiBaseUrl({
  configured: import.meta.env.VITE_API_URL,
  production: import.meta.env.PROD,
  native: Capacitor.isNativePlatform(),
});

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("master_token") || localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  startRequest();

  return config;
});

// Add response error handling for 401 errors
api.interceptors.response.use(
  (response) => {
    endRequest();
    return requireJsonResponse(response);
  },
  (error) => {
    endRequest();

    if (error.response?.status === 401) {
      // Clear auth on 401 response
      localStorage.removeItem("master_token");
      localStorage.removeItem("token");
      localStorage.removeItem("master_user");
      // Optionally redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;