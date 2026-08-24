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
import RideStatusTracker from "./components/RideStatusTracker.jsx";
import DriverHistory from "./components/DriverHistory.jsx";
import PassengerHistory from "./components/PassengerHistory.jsx";
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
import FindRidePage from "./components/FindRidePage.jsx";
import MyRidesPage from "./components/MyRidesPage.jsx";
import RecurringPage from "./components/RecurringPage.jsx";
import { AuthContext } from "./auth.js";
import { NotificationProvider } from "./notifications.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("React ErrorBoundary caught an error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-card">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-slate-800">Something went wrong</h2>
            <p className="mt-2 text-xs text-slate-500">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/login";
                }}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-900"
              >
                Reset & Go to Login
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/dashboard";
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Retry Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuthed({ children }) {
  const token = localStorage.getItem("token");
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
  const token = localStorage.getItem("token");
  return token ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function PublicLayout() {
  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-slate-50">
      <header className="border-b border-slate-100 bg-white">
        <div className="flex w-full items-center gap-2 px-6 py-4 lg:px-10">
          <Link to="/" className="flex items-center gap-2 rounded-lg transition hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              CR
            </div>
            <span className="text-sm font-bold text-slate-800">Campus Ride Sharing</span>
          </Link>
        </div>
      </header>
      <Outlet />
      <NotificationToast />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    element: <PublicLayout />,
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
        path: "/banned",
        element: <Banned />,
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
    ],
  },
  {
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: "/dashboard",
        element: <Dashboard />,
      },
      {
        path: "/rides/new",
        element: <NewRide />,
      },
      {
        path: "/profile",
        element: <ProfileSetup />,
      },
      {
        path: "/payments",
        element: <PaymentRequests />,
      },
      {
        path: "/payments/:id",
        element: <PaymentDetails />,
      },
      {
        path: "/rides/:rideId/payments",
        element: <RidePaymentManagement />,
      },
      {
        path: "/ride-payments/:paymentId",
        element: <RidePaymentDetails />,
      },
      {
        path: "/transactions",
        element: <TransactionHistory />,
      },
      {
        path: "/dues",
        element: <NetBalances />,
      },
      {
        path: "/ride-tracker",
        element: <RideStatusTracker />,
      },
      {
        path: "/ride-history/driver",
        element: <DriverHistory />,
      },
      {
        path: "/ride-history/passenger",
        element: <PassengerHistory />,
      },
      {
        path: "/find-ride",
        element: <FindRidePage />,
      },
      {
        path: "/my-rides",
        element: <MyRidesPage />,
      },
      {
        path: "/recurring",
        element: <RecurringPage />,
      },
    ],
  },
  {
    path: "*",
    element: <RootRedirect />,
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
          <ErrorBoundary>
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
          </ErrorBoundary>
        </NotificationProvider>
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}
