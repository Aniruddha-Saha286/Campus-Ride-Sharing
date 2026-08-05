import React, { useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Link,
  Outlet,
} from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Login from "./components/Login.jsx";
import ProfileSetup from "./components/ProfileSetup.jsx";
import Dashboard from "./components/Dashboard.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import Banned from "./components/Banned.jsx";
import { AuthContext } from "./auth.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function Header() {
  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="flex w-full items-center gap-2 px-6 py-4 lg:px-10">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-lg transition hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            CR
          </div>
          <span className="text-sm font-bold text-slate-800">
            Campus Ride Sharing
          </span>
        </Link>
      </div>
    </header>
  );
}

function RequireAuth({ children }) {
  const { token } = React.useContext(AuthContext);
  return token ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuthed({ children }) {
  const { token } = React.useContext(AuthContext);
  return token ? <Navigate to="/dashboard" replace /> : children;
}

function RequireAdmin({ children }) {
  const adminToken = localStorage.getItem("adminToken");
  return adminToken ? children : <Navigate to="/admin/login" replace />;
}

function RedirectIfAdmin({ children }) {
  const adminToken = localStorage.getItem("adminToken");
  return adminToken ? <Navigate to="/admin" replace /> : children;
}

function RootRedirect() {
  const { token } = React.useContext(AuthContext);
  return token ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function Layout() {
  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-slate-50">
      <Header />
      <Outlet />
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: "/login",
        element: (
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: "/profile",
        element: (
          <RequireAuth>
            <ProfileSetup />
          </RequireAuth>
        ),
      },
      {
        path: "/admin/login",
        element: (
          <RedirectIfAdmin>
            <AdminLogin />
          </RedirectIfAdmin>
        ),
      },
      {
        path: "/admin",
        element: (
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        ),
      },
      {
        path: "/banned",
        element: <Banned />,
      },
      {
        path: "*",
        element: <RootRedirect />,
      },
    ],
  },
]);

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  const handleLogin = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthContext.Provider value={{ token, handleLogin, handleLogout }}>
        {!GOOGLE_CLIENT_ID ? (
          <div className="w-full min-h-screen overflow-x-hidden bg-slate-50">
            <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">
              <p className="font-semibold text-slate-700">
                Google sign-in is not configured yet.
              </p>
              <p className="mt-2">
                Copy the Google Client ID into{" "}
                <code className="text-brand-600">frontend/.env</code> as{" "}
                <code className="text-brand-600">VITE_GOOGLE_CLIENT_ID</code>{" "}
                and restart the dev server.
              </p>
            </div>
          </div>
        ) : (
          <RouterProvider router={router} />
        )}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}
