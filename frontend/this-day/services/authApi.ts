import api from "./api";

export async function loginBackend() {
  const res = await api.get("/api/login");
  return res.data;
}
