import axios from "axios";
import { getToken } from "./auth";
import { API_BASE_URL } from "./apiBase";
import { clearToken } from "./auth";
import { router } from "expo-router";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        await clearToken();
      } catch {
        // Best-effort only
      }
      try {
        router.replace("/login");
      } catch {
        // Best-effort only
      }
    }
    return Promise.reject(error);
  }
);

export default api;
