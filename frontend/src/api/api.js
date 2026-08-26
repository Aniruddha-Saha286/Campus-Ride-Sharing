import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const client = axios.create({ baseURL: API_BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.config?.headers?.Authorization) {
      const msg = error.response?.data?.message || "";
      if (msg.toLowerCase().includes("banned")) {
        localStorage.setItem("bannedReason", msg || "Your account has been banned");
        localStorage.removeItem("token");
        if (window.location.pathname !== "/banned") {
          window.location.href = "/banned";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const getMyProfile = () => client.get("/students/profile/me");

export const loginWithGoogle = (credential) =>
  client.post("/auth/google", { credential });

export const createProfile = (payload, idCardFile) => {
  const formData = new FormData();
  formData.append("profile", JSON.stringify(payload));
  if (idCardFile) formData.append("studentIdCard", idCardFile);
  return client.post("/students/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const updateProfile = (payload) =>
  client.put("/students/profile", payload);

export const uploadProfilePhoto = (file) => {
  const formData = new FormData();
  formData.append("profilePhoto", file);
  return client.post("/students/profile/photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteProfilePhoto = () =>
  client.delete("/students/profile/photo");

export const uploadStudentIdCard = (file) => {
  const formData = new FormData();
  formData.append("studentIdCard", file);
  return client.post("/students/profile/idcard", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteAccount = () => client.delete("/students/profile");

const adminClient = axios.create({ baseURL: API_BASE });

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const adminLogin = (email, password) =>
  adminClient.post("/admin/login", { email, password });

export const getVerifications = (status = "pending") =>
  adminClient.get(`/admin/verifications?status=${status}`);

export const getUsers = (search = "") =>
  adminClient.get("/admin/users", { params: { search } });

export const getAdminStats = () => adminClient.get("/admin/stats");

export const banUser = (id, reason) =>
  adminClient.put(`/admin/users/${id}/ban`, { reason });

export const unbanUser = (id) =>
  adminClient.put(`/admin/users/${id}/unban`);

export const reviewVerification = (id, decision, note) =>
  adminClient.put(`/admin/verifications/${id}`, { decision, note });

export const getAdminRideTracker = () =>
  adminClient.get("/admin/rides/tracker");

export const getAdminUserRides = (userId) =>
  adminClient.get(`/admin/users/${userId}/rides`);
