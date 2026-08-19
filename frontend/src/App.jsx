import React, { useState, useCallback } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Login from "./components/Login.jsx";
import ProfileSetup from "./components/ProfileSetup.jsx";
import Dashboard from "./components/Dashboard.jsx";
import NewRide from "./components/NewRide.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";
import Banned from "./components/Banned.jsx";
import PaymentRequests from "./components/PaymentRequests.jsx";
import PaymentDetails from "./components/PaymentDetails.jsx";
import RidePaymentManagement from "./components/RidePaymentManagement.jsx";
import RidePaymentDetails from "./components/RidePaymentDetails.jsx";
import TransactionHistory from "./components/TransactionHistory.jsx";
import NetBalances from "./components/NetBalances.jsx";
import NotificationToast from "./components/NotificationToast.jsx";
import { AuthContext } from "./auth.js";
import { NotificationProvider } from "./notifications.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function Header() {
  const { token } = React.useContext(AuthContext);
  const location = useLocation();
  const logoTo = location.pathname.startsWith("/admin")
    ? "/admin"
    : token
      ? "/dashboard"
      : "/";
  const isLogoTarget = location.pathname === logoTo;
  return (
    <header className="border-b border-slate-100 bg-white">
      <div className="flex w-full items-center gap-2 px-6 py-4 lg:px-10">
        <Link
          to={logoTo}
          reloadDocument={isLogoTarget}
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
      <NotificationToast />
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
        path: "/rides/new",
        element: (
          <RequireAuth>
            <NewRide />
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
        path: "/payments",
        element: (
          <RequireAuth>
            <PaymentRequests />
          </RequireAuth>
        ),
      },
      {
        path: "/payments/:id",
        element: (
          <RequireAuth>
            <PaymentDetails />
          </RequireAuth>
        ),
      },
      {
        path: "/rides/:rideId/payments",
        element: (
          <RequireAuth>
            <RidePaymentManagement />
          </RequireAuth>
        ),
      },
      {
        path: "/ride-payments/:paymentId",
        element: (
          <RequireAuth>
            <RidePaymentDetails />
          </RequireAuth>
        ),
      },
      {
        path: "/transactions",
        element: (
          <RequireAuth>
            <TransactionHistory />
          </RequireAuth>
        ),
      },
      {
        path: "/dues",
        element: (
          <RequireAuth>
            <NetBalances />
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

  const handleLogin = useCallback((newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
  }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthContext.Provider value={{ token, handleLogin, handleLogout }}>
        <NotificationProvider>
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
        </NotificationProvider>
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}
