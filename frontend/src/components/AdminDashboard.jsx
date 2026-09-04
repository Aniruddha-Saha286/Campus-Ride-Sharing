import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Loader2,
  LogOut,
  BadgeCheck,
  XCircle,
  Clock3,
  Check,
  X,
  Eye,
  Users,
  Search,
  User,
  GraduationCap,
  MapPin,
  Phone,
  Home,
  Fingerprint,
  Ban,
  CircleCheck,
  Car,
  Navigation,
  History,
  Calendar,
  Wallet,
  ShieldAlert,
  AlertTriangle,
  ArrowUpDown,
  MessageSquare,
  Send,
  Headphones,
  Bug,
  ThumbsUp,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  getVerifications,
  reviewVerification,
  getUsers,
  getAdminStats,
  banUser,
  unbanUser,
  getAdminRideTracker,
  getAdminUserRides,
} from "../api/api";
import {
  getAdminSafetyReports,
  updateAdminSafetyReportStatus,
} from "../api/safetyReportApi";
import {
  getAdminFeedbacks,
  updateAdminFeedback,
  deleteAdminFeedback,
} from "../api/userFeedbackApi";
import { onRealtime } from "../api/realtimeBus";
import { formatTime12Hour, TRIP_META } from "../utils/rideStatusConstants";


const STATUS_META = {
  none: { label: "Not submitted", classes: "bg-slate-100 text-slate-600", Icon: ShieldCheck },
  pending: { label: "Pending", classes: "bg-amber-50 text-amber-700", Icon: Clock3 },
  approved: { label: "Verified", classes: "bg-emerald-50 text-emerald-700", Icon: BadgeCheck },
  rejected: { label: "Rejected", classes: "bg-rose-50 text-rose-700", Icon: XCircle },
};

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] || str;
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-slate-50 py-2 text-sm">
    <span className="shrink-0 text-slate-500">{label}</span>
    <span className="text-right font-medium text-slate-800">{value || "—"}</span>
  </div>
);

const DetailBlock = ({ title, icon: Icon, children }) => (
  <div className="rounded-xl bg-slate-50/70 p-4">
    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
      <Icon size={13} className="text-brand-600" />
      {title}
    </p>
    <div>{children}</div>
  </div>
);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("verifications");
  const [filter, setFilter] = useState("pending");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [stats, setStats] = useState(null);

  // Live Tracker State
  const [trackerList, setTrackerList] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerFilter, setTrackerFilter] = useState("all");
  const [trackerError, setTrackerError] = useState("");

  // Safety Reports State
  const [safetyReports, setSafetyReports] = useState([]);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState("");
  const [safetyFilter, setSafetyFilter] = useState("needs_resolution"); // 'needs_resolution' | 'resolved' | 'all'
  const [safetySort, setSafetySort] = useState("newest"); // 'newest' | 'oldest'
  const [safetyBusy, setSafetyBusy] = useState("");
  const [newReportAlert, setNewReportAlert] = useState("");

  // Per-User Ride History State
  const [userRides, setUserRides] = useState(null);
  const [userRidesLoading, setUserRidesLoading] = useState(false);
  const [userRidesView, setUserRidesView] = useState("driver");

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login");
  };

  const loadSafetyReports = async () => {
    setSafetyLoading(true);
    setSafetyError("");
    try {
      const { data } = await getAdminSafetyReports({
        status: safetyFilter,
        sort: safetySort,
      });
      setSafetyReports(data.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      } else {
        setSafetyError(err.response?.data?.message || "Could not load safety reports.");
      }
    } finally {
      setSafetyLoading(false);
    }
  };

  const handleUpdateReportStatus = async (reportId, newStatus) => {
    setSafetyBusy(reportId);
    setSafetyError("");
    try {
      await updateAdminSafetyReportStatus(reportId, newStatus);
      await loadSafetyReports();
    } catch (err) {
      setSafetyError(err.response?.data?.message || "Could not update report status.");
    } finally {
      setSafetyBusy("");
    }
  };

  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState("all");
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState("all");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState("");
  const [feedbackReplyInputs, setFeedbackReplyInputs] = useState({});
  const [newFeedbackAlert, setNewFeedbackAlert] = useState("");

  const loadFeedbacks = async () => {
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      const { data } = await getAdminFeedbacks({
        status: feedbackStatusFilter,
        type: feedbackTypeFilter,
        search: feedbackSearch,
      });
      setFeedbacks(data.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      } else {
        setFeedbackError(err.response?.data?.message || "Could not load user feedback.");
      }
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleUpdateFeedback = async (id, newStatus, customReply) => {
    setFeedbackBusy(id);
    setFeedbackError("");
    try {
      const payload = {};
      if (newStatus) payload.status = newStatus;
      if (customReply !== undefined) payload.adminReply = customReply;
      await updateAdminFeedback(id, payload);
      await loadFeedbacks();
    } catch (err) {
      setFeedbackError(err.response?.data?.message || "Could not update message status.");
    } finally {
      setFeedbackBusy("");
    }
  };

  const handleDeleteFeedback = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this user message/complaint?")) {
      return;
    }
    setFeedbackBusy(id);
    setFeedbackError("");
    try {
      await deleteAdminFeedback(id);
      await loadFeedbacks();
    } catch (err) {
      setFeedbackError(err.response?.data?.message || "Could not delete feedback.");
    } finally {
      setFeedbackBusy("");
    }
  };


  const loadTracker = async () => {
    setTrackerLoading(true);
    setTrackerError("");
    try {
      const { data } = await getAdminRideTracker();
      setTrackerList(data.data || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      } else {
        setTrackerError(err.response?.data?.message || "Could not load live rides tracker.");
      }
    } finally {
      setTrackerLoading(false);
    }
  };

  const loadUserRides = async (userId) => {
    setUserRidesLoading(true);
    try {
      const { data } = await getAdminUserRides(userId);
      setUserRides(data.data);
    } catch (err) {
      setUserRides(null);
    } finally {
      setUserRidesLoading(false);
    }
  };

  const loadUsers = async (term) => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const { data } = await getUsers(term);
      setUsers(data.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      } else {
        setUsersError(err.response?.data?.message || "Could not load users.");
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await getAdminStats();
      setStats(data.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    loadStats();
    loadTracker();
    loadSafetyReports();
    loadFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const off = onRealtime((event) => {
      if (event?.type === "SAFETY_REPORT_CREATED") {
        setNewReportAlert(event.body || "A new safety concern has just been reported!");
        loadSafetyReports();
      }
      if (event?.type === "FEEDBACK_SUBMITTED") {
        setNewFeedbackAlert(event.body || "A student submitted a new message / complaint / feedback!");
        loadFeedbacks();
      }
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyFilter, safetySort, feedbackStatusFilter, feedbackTypeFilter]);

  const load = async (status) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getVerifications(status);
      setList(data.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      } else {
        setError(err.response?.data?.message || "Could not load verifications.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "verifications") load(filter);
    if (tab === "tracker") loadTracker();
    if (tab === "safety") loadSafetyReports();
    if (tab === "feedback") loadFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter, safetyFilter, safetySort, feedbackStatusFilter, feedbackTypeFilter]);

  useEffect(() => {
    if (tab !== "users") return;
    const timer = setTimeout(() => loadUsers(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  useEffect(() => {
    if (tab !== "feedback") return;
    const timer = setTimeout(() => loadFeedbacks(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, feedbackSearch]);

  const openStudent = (student) => {
    setSelected(student);
    setNote("");
    setShowNoteInput(false);
  };

  const openAction = (student, mode) => {
    setActionTarget({ student, mode });
    setBanReason(student.banReason || "");
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    setActionBusy(true);
    setUsersError("");
    try {
      if (actionTarget.mode === "ban") {
        await banUser(actionTarget.student._id, banReason);
      } else {
        await unbanUser(actionTarget.student._id);
      }
      setActionTarget(null);
      if (selectedUser && selectedUser._id === actionTarget.student._id) {
        setSelectedUser(null);
      }
      loadUsers(search);
    } catch (err) {
      setUsersError(err.response?.data?.message || "Could not update the user's status.");
    } finally {
      setActionBusy(false);
    }
  };

  const submitDecision = async (decision) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await reviewVerification(selected._id, decision, note);
      setSelected(null);
      setShowNoteInput(false);
      load(filter);
    } catch (err) {
      setError(err.response?.data?.message || "Could not update verification.");
    } finally {
      setBusy(false);
    }
  };

  const tabButton = (id, label, icon) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        tab === id
          ? "bg-slate-800 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
              <ShieldCheck size={24} className="text-slate-700" />
              Admin panel
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage students and review university ID verifications.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-500 transition hover:border-rose-300 hover:text-rose-500"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabButton("verifications", "ID Verification", <ShieldCheck size={15} />)}
          {tabButton("users", "Users", <Users size={15} />)}
          {tabButton("tracker", "Live Ride Tracker", <Car size={15} />)}
          <button
            onClick={() => {
              setTab("safety");
              setNewReportAlert("");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "safety"
                ? "bg-rose-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <ShieldAlert size={15} />
            Safety Concerns
            {safetyReports.filter((r) => r.status !== "Resolved").length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  tab === "safety" ? "bg-white text-rose-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {safetyReports.filter((r) => r.status !== "Resolved").length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setTab("feedback");
              setNewFeedbackAlert("");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer ${
              tab === "feedback"
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <MessageSquare size={15} />
            User Feedback & Messages
            {feedbacks.filter((f) => f.status === "Pending").length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  tab === "feedback" ? "bg-white text-indigo-700" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {feedbacks.filter((f) => f.status === "Pending").length}
              </span>
            )}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex flex-1 min-w-[180px] items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registered students
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">
                {stats === null ? (
                  <Loader2 className="animate-spin text-slate-300" size={22} />
                ) : (
                  stats.registeredStudents
                )}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Users size={22} />
            </div>
          </div>

          <div className="flex flex-1 min-w-[180px] items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active Live Trips
              </p>
              <p className="mt-1 text-3xl font-extrabold text-blue-600">
                {trackerList.filter((t) => t.tripStatus !== "completed").length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Car size={22} />
            </div>
          </div>

          <div className="flex flex-1 min-w-[180px] items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Safety Concerns
              </p>
              <p className="mt-1 text-3xl font-extrabold text-rose-600">
                {safetyReports.filter((r) => r.status !== "Resolved").length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert size={22} />
            </div>
          </div>

          <div className="flex flex-1 min-w-[180px] items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pending Feedback
              </p>
              <p className="mt-1 text-3xl font-extrabold text-indigo-600">
                {feedbacks.filter((f) => f.status === "Pending").length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare size={22} />
            </div>
          </div>
        </div>

        {tab === "verifications" ? (
          <>
            <div className="mb-4 flex gap-2">
              {["pending", "approved", "rejected"].map((status) => {
                const meta = STATUS_META[status];
                const active = filter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-800 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <meta.Icon size={14} />
                    {meta.label}
                  </button>
                );
              })}
              <button
                onClick={() => load(filter)}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={28} />
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
                <ShieldCheck size={28} className="text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  No {filter} verifications
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {filter === "pending"
                    ? "Students who upload an ID card will appear here."
                    : "There are no students with this status yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((student) => {
                  const meta = STATUS_META[student.idVerificationStatus] || STATUS_META.pending;
                  return (
                    <div
                      key={student._id}
                      className="flex flex-wrap items-center justify-between gap-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-card"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={student.studentIdCard}
                          alt="ID card"
                          className="h-16 w-28 rounded-lg border border-slate-200 object-cover"
                        />
                        <div>
                          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                            {student.name}
                            {student.idVerificationStatus === "approved" && (
                              <BadgeCheck size={15} className="fill-brand-600 text-white" />
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {student.studentId} · {student.department}, {student.year}
                          </p>
                          <p className="text-xs text-slate-400">{student.universityEmail}</p>
                          {student.idVerificationNote && (
                            <p className="mt-1 text-xs font-medium text-rose-500">
                              Note: {student.idVerificationNote}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.classes}`}
                        >
                          <meta.Icon size={13} />
                          {meta.label}
                        </span>
                        <button
                          onClick={() => openStudent(student)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                        >
                          <Eye size={14} />
                          Review
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === "users" ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, student ID or email"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <button
                onClick={() => setSearch("")}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Clear
              </button>
            </div>

            {usersError && (
              <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                {usersError}
              </div>
            )}

            {usersLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={28} />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
                <Users size={28} className="text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  {search ? "No students match your search" : "No students yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((student) => {
                  const meta = STATUS_META[student.idVerificationStatus] || STATUS_META.none;
                  return (
                    <div
                      key={student._id}
                      className="flex flex-wrap items-center justify-between gap-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-card"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                          {student.profilePhoto ? (
                            <img
                              src={student.profilePhoto}
                              alt="Profile"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User size={20} className="text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                            {student.name}
                            {student.idVerificationStatus === "approved" && (
                              <BadgeCheck size={15} className="fill-brand-600 text-white" />
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {student.studentId} · {student.department}, {student.year}
                          </p>
                          <p className="text-xs text-slate-400">{student.universityEmail}</p>
                          {student.isBanned && (
                            <p className="mt-1 text-xs font-medium text-rose-600">
                              Banned: {student.banReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {student.isBanned ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                            <Ban size={13} />
                            Banned
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.classes}`}
                          >
                            <meta.Icon size={13} />
                            {meta.label}
                          </span>
                        )}
                        <button
                          onClick={() => { setSelectedUser(student); setUserRides(null); }}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                        >
                          <Eye size={14} />
                          View details
                        </button>
                        {student.isBanned ? (
                          <button
                            onClick={() => openAction(student, "unban")}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          >
                            <CircleCheck size={14} />
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => openAction(student, "ban")}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            <Ban size={14} />
                            Ban
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === "tracker" ? (
          <>
            {/* Live Ride Tracker Tab View */}
            <div className="mb-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Filter Chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "active", label: "Active Trips" },
                    { id: "upcoming", label: "Upcoming" },
                    { id: "ongoing", label: "Ongoing" },
                    { id: "completed", label: "Completed" },
                    { id: "all", label: "All Rides" },
                  ].map((filterTab) => {
                    const active = trackerFilter === filterTab.id;
                    const count =
                      filterTab.id === "active"
                        ? trackerList.filter((t) => t.tripStatus !== "completed").length
                        : filterTab.id === "all"
                        ? trackerList.length
                        : trackerList.filter((t) => t.tripStatus === filterTab.id).length;

                    return (
                      <button
                        key={filterTab.id}
                        onClick={() => setTrackerFilter(filterTab.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                          active
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {filterTab.label}
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                            active ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={loadTracker}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                >
                  Refresh
                </button>
              </div>
            </div>

            {trackerError && (
              <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                {trackerError}
              </div>
            )}

            {trackerLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={28} />
              </div>
            ) : trackerList.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
                <Car size={30} className="text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">No active trips being tracked</p>
                <p className="mt-1 text-xs text-slate-400">When students post and start rides, they will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trackerList
                  .filter((entry) => {
                    if (trackerFilter === "active") return entry.tripStatus !== "completed";
                    if (trackerFilter === "all") return true;
                    return entry.tripStatus === trackerFilter;
                  })
                  .map((entry) => {
                    const meta = TRIP_META[entry.tripStatus] || TRIP_META.upcoming;
                    const ride = entry.ride;
                    if (!ride) return null;
                    return (
                      <div
                        key={entry._id}
                        className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition-shadow hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                title={ride.pickup}
                                className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                              >
                                <MapPin size={11} className="shrink-0" />
                                {shortLabel(ride.pickup)}
                              </span>
                              <Navigation size={13} className="shrink-0 text-slate-300" />
                              <span
                                title={ride.dropoff}
                                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                              >
                                <MapPin size={11} className="shrink-0" />
                                {shortLabel(ride.dropoff)}
                              </span>
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                <Clock3 size={13} className="text-blue-600" />
                                Departure: {formatTime12Hour(ride.departureTime)}
                              </span>
                              <span>·</span>
                              <span>Seats: {ride.seats}</span>
                              <span>·</span>
                              <span>Fare: {ride.charge > 0 ? `৳${ride.charge}` : "Free"}</span>
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${meta.classes}`}>
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>

                        {/* Driver & Passenger Details */}
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                          {/* Driver Info */}
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Driver</p>
                            <div className="mt-1 flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                                {ride.poster?.name?.charAt(0) || "D"}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{ride.poster?.name}</p>
                                <p className="text-[11px] text-slate-500">{ride.poster?.studentId} · {ride.poster?.phone || ride.poster?.universityEmail}</p>
                              </div>
                            </div>
                          </div>

                          {/* Passengers Info */}
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Accepted Passengers ({entry.passengers?.length || 0})
                            </p>
                            {!entry.passengers || entry.passengers.length === 0 ? (
                              <p className="mt-1.5 text-[11px] text-slate-400">No passengers booked yet</p>
                            ) : (
                              <div className="mt-1 space-y-1.5">
                                {entry.passengers.map((p) => (
                                  <div key={p._id} className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-slate-700">{p.rider?.name} ({p.seats} seat)</span>
                                    <span className="text-slate-400">{p.rider?.phone || p.rider?.studentId}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        ) : tab === "safety" ? (
          <>
            {/* Safety Concerns & Reports Tab View */}
            {newReportAlert && (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 animate-pulse">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                  <span>{newReportAlert}</span>
                </div>
                <button
                  onClick={() => setNewReportAlert("")}
                  className="rounded-lg bg-rose-200/60 px-2 py-1 hover:bg-rose-200 text-rose-800 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="mb-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Separate Sections for Needs Resolution vs Resolved */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "needs_resolution", label: "Needs Resolution" },
                    { id: "resolved", label: "Resolved Reports" },
                    { id: "all", label: "All Complaints" },
                  ].map((filterTab) => {
                    const active = safetyFilter === filterTab.id;
                    const count =
                      filterTab.id === "needs_resolution"
                        ? safetyReports.filter((r) => r.status !== "Resolved").length
                        : filterTab.id === "resolved"
                        ? safetyReports.filter((r) => r.status === "Resolved").length
                        : safetyReports.length;

                    return (
                      <button
                        key={filterTab.id}
                        onClick={() => setSafetyFilter(filterTab.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          active
                            ? "bg-rose-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {filterTab.label}
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                            active ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Sort Dropdown & Refresh */}
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <ArrowUpDown size={13} className="pointer-events-none absolute left-3 text-slate-400" />
                    <select
                      value={safetySort}
                      onChange={(e) => setSafetySort(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-bold text-slate-700 shadow-2xs outline-none transition hover:border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </div>
                  <button
                    onClick={loadSafetyReports}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {safetyError && (
              <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                {safetyError}
              </div>
            )}

            {safetyLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="animate-spin text-rose-600" size={28} />
              </div>
            ) : safetyReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
                <ShieldAlert size={30} className="text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">No safety concerns reported in this view</p>
                <p className="mt-1 text-xs text-slate-400">
                  When students or drivers report safety concerns, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {safetyReports.map((report) => {
                  const trip = report.trip;
                  const isResolved = report.status === "Resolved";
                  const isReviewed = report.status === "Reviewed";
                  const isPending = report.status === "Pending";

                  return (
                    <div
                      key={report._id}
                      className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition-shadow hover:shadow-md space-y-4"
                    >
                      {/* Header: Category & Status */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                            <AlertTriangle size={13} className="text-rose-600" />
                            {report.category}
                          </span>
                          <span className="text-xs text-slate-400">
                            Reported {formatDate(report.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                              isResolved
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : isReviewed
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isResolved
                                  ? "bg-emerald-500"
                                  : isReviewed
                                  ? "bg-blue-500"
                                  : "bg-amber-500 animate-pulse"
                              }`}
                            />
                            {report.status}
                          </span>
                        </div>
                      </div>

                      {/* Description Box */}
                      <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Concern Description
                        </p>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          "{report.description}"
                        </p>
                      </div>

                      {/* Trip Details (Clean Route, NO raw Trip ID) */}
                      {trip && (
                        <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-100/80">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Associated Trip Route
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
                            <span className="flex items-center gap-1 text-slate-700">
                              <MapPin size={12} className="text-emerald-600" />
                              {shortLabel(trip.pickup)}
                            </span>
                            <Navigation size={12} className="text-slate-400" />
                            <span className="flex items-center gap-1 text-slate-700">
                              <MapPin size={12} className="text-rose-600" />
                              {shortLabel(trip.dropoff)}
                            </span>
                            {trip.departureTime && (
                              <span className="ml-auto flex items-center gap-1 font-semibold text-slate-500">
                                <Clock3 size={12} />
                                {formatTime12Hour(trip.departureTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reporter & Driver Details Grid */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                        {/* Reporter details */}
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Reported By (Complainant)
                          </p>
                          <p className="font-bold text-slate-800 mt-1">{report.reporter?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {report.reporter?.studentId} · {report.reporter?.department} ({report.reporter?.year})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {report.reporter?.phone || report.reporter?.universityEmail}
                          </p>
                        </div>

                        {/* Driver details */}
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Driver of the Trip
                          </p>
                          <p className="font-bold text-slate-800 mt-1">{trip?.poster?.name || "—"}</p>
                          <p className="text-[11px] text-slate-500">
                            {trip?.poster?.studentId} · {trip?.poster?.department} ({trip?.poster?.year})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {trip?.poster?.phone || trip?.poster?.universityEmail}
                          </p>
                        </div>
                      </div>

                      {/* Admin Action Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        {isPending && (
                          <button
                            onClick={() => handleUpdateReportStatus(report._id, "Reviewed")}
                            disabled={safetyBusy === report._id}
                            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 cursor-pointer"
                          >
                            {safetyBusy === report._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Mark as Reviewed
                          </button>
                        )}

                        {!isResolved ? (
                          <button
                            onClick={() => handleUpdateReportStatus(report._id, "Resolved")}
                            disabled={safetyBusy === report._id}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 shadow-xs disabled:opacity-60 cursor-pointer"
                          >
                            {safetyBusy === report._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Resolve Concern
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateReportStatus(report._id, "Pending")}
                            disabled={safetyBusy === report._id}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
                          >
                            {safetyBusy === report._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Clock3 size={12} />
                            )}
                            Reopen Report
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {newFeedbackAlert && (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-xs font-bold text-indigo-800 animate-pulse">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-600 shrink-0" />
                  <span>{newFeedbackAlert}</span>
                </div>
                <button
                  onClick={() => setNewFeedbackAlert("")}
                  className="rounded-lg bg-indigo-200/60 px-2 py-1 hover:bg-indigo-200 text-indigo-800 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="mb-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "All Messages" },
                    { id: "pending", label: "Pending Action" },
                    { id: "reviewed", label: "Reviewed" },
                    { id: "resolved", label: "Resolved" },
                  ].map((filterTab) => {
                    const active = feedbackStatusFilter === filterTab.id;
                    const count =
                      filterTab.id === "pending"
                        ? feedbacks.filter((f) => f.status === "Pending").length
                        : filterTab.id === "reviewed"
                        ? feedbacks.filter((f) => f.status === "Reviewed").length
                        : filterTab.id === "resolved"
                        ? feedbacks.filter((f) => f.status === "Resolved").length
                        : feedbacks.length;

                    return (
                      <button
                        key={filterTab.id}
                        onClick={() => setFeedbackStatusFilter(filterTab.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          active
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        }`}
                      >
                        {filterTab.label}
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                            active ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Type:</span>
                  <select
                    value={feedbackTypeFilter}
                    onChange={(e) => setFeedbackTypeFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="Complaint">Complaints</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Bug Report">Bug Reports</option>
                    <option value="General Inquiry">General Inquiries</option>
                    <option value="Other">Other</option>
                  </select>

                  <button
                    onClick={() => loadFeedbacks()}
                    disabled={feedbackLoading}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <RefreshCw size={13} className={feedbackLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  placeholder="Search by student name, ID, email, subject, or message content..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                {feedbackSearch && (
                  <button
                    onClick={() => setFeedbackSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {feedbackError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                {feedbackError}
              </div>
            )}

            {feedbackLoading && feedbacks.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-12 text-slate-400">
                <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
                <p className="text-sm font-medium">Loading user feedback & messages...</p>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                <div className="rounded-full bg-indigo-50 p-3 text-indigo-500 mb-3">
                  <Headphones size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-800">No messages found</h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm">
                  {feedbackSearch
                    ? `No submissions matched "${feedbackSearch}".`
                    : "No user complaints or feedback match the selected filters."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((item) => {
                  const isResolved = item.status === "Resolved";
                  const isReviewed = item.status === "Reviewed";

                  const typeStyles = {
                    Complaint: "bg-rose-50 text-rose-700 border-rose-200",
                    Feedback: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    "Bug Report": "bg-amber-50 text-amber-700 border-amber-200",
                    "General Inquiry": "bg-sky-50 text-sky-700 border-sky-200",
                    Other: "bg-slate-100 text-slate-700 border-slate-200",
                  }[item.type] || "bg-slate-100 text-slate-700 border-slate-200";

                  const replyDraft =
                    feedbackReplyInputs[item._id] !== undefined
                      ? feedbackReplyInputs[item._id]
                      : item.adminReply || "";

                  return (
                    <div
                      key={item._id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white shadow-xs">
                            {item.user?.name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {item.user?.name || "Unknown Student"}
                              </h4>
                              <span className="text-xs text-slate-400">
                                {item.user?.studentId || "No ID"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {item.user?.universityEmail} {item.user?.phone && `· ${item.user.phone}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${typeStyles}`}>
                            {item.type}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              isResolved
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : isReviewed
                                ? "bg-sky-50 text-sky-700 border border-sky-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {isResolved ? (
                              <Check size={12} />
                            ) : isReviewed ? (
                              <Eye size={12} />
                            ) : (
                              <Clock3 size={12} />
                            )}
                            {item.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <h5 className="text-sm font-bold text-slate-900">
                          {item.subject}
                        </h5>
                        <p className="mt-1 text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                          {item.message}
                        </p>
                        <div className="mt-2 text-[11px] text-slate-400">
                          Submitted on {formatDate(item.createdAt)}
                        </div>
                      </div>

                      {item.adminReply && (
                        <div className="mt-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 size={14} className="text-emerald-600" />
                              Current Admin Response:
                            </span>
                            <span className="text-[10px] font-normal text-emerald-700">
                              Replied: {formatDate(item.repliedAt)}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-emerald-950 whitespace-pre-line">
                            {item.adminReply}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          {item.adminReply ? "Edit Response to Student:" : "Write Response to Student:"}
                        </label>
                        <textarea
                          rows={2}
                          value={replyDraft}
                          onChange={(e) =>
                            setFeedbackReplyInputs((prev) => ({
                              ...prev,
                              [item._id]: e.target.value,
                            }))
                          }
                          placeholder="Type an answer or resolution note to the student..."
                          className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-y"
                        />

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleUpdateFeedback(
                                  item._id,
                                  item.status === "Pending" ? "Reviewed" : item.status,
                                  replyDraft
                                )
                              }
                              disabled={feedbackBusy === item._id || !replyDraft || !replyDraft.trim()}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                              {feedbackBusy === item._id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}
                              Send Reply
                            </button>
                          </div>

                          <div className="flex items-center gap-2 ml-auto">
                            {!isReviewed && !isResolved && (
                              <button
                                onClick={() => handleUpdateFeedback(item._id, "Reviewed", replyDraft || undefined)}
                                disabled={feedbackBusy === item._id}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-60 cursor-pointer"
                              >
                                {feedbackBusy === item._id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Eye size={12} />
                                )}
                                Mark as Reviewed
                              </button>
                            )}

                            {!isResolved ? (
                              <button
                                onClick={() =>
                                  handleUpdateFeedback(
                                    item._id,
                                    "Resolved",
                                    replyDraft || undefined
                                  )
                                }
                                disabled={feedbackBusy === item._id}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs disabled:opacity-60 cursor-pointer"
                              >
                                {feedbackBusy === item._id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                                Mark as Resolved
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateFeedback(item._id, "Pending")}
                                disabled={feedbackBusy === item._id}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-60 cursor-pointer"
                              >
                                {feedbackBusy === item._id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Clock3 size={12} />
                                )}
                                Reopen Message
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteFeedback(item._id)}
                              disabled={feedbackBusy === item._id}
                              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition disabled:opacity-60 cursor-pointer"
                              title="Delete message"
                            >
                              {feedbackBusy === item._id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Review ID card</h3>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <img
                src={selected.studentIdCard}
                alt="University ID card"
                className="mx-auto max-h-72 rounded-xl border border-slate-200 object-contain"
              />
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <p className="font-bold text-slate-800">{selected.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selected.studentId} · {selected.department}, {selected.year}
                </p>
                <p className="text-xs text-slate-500">{selected.universityEmail}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              {selected.idVerificationStatus === "approved" ? (
                <p className="text-sm font-medium text-emerald-600">
                  This student is already verified.
                </p>
              ) : showNoteInput ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Rejection reason (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                    placeholder="e.g. Card is blurry or does not match the profile"
                  />
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                  onClick={() => {
                    if (selected.idVerificationStatus === "approved") {
                      setSelected(null);
                    } else if (showNoteInput) {
                      submitDecision("rejected");
                    } else {
                      setShowNoteInput(true);
                    }
                  }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy && showNoteInput ? <Loader2 className="animate-spin" size={15} /> : <XCircle size={15} />}
                  {selected.idVerificationStatus === "approved"
                    ? "Close"
                    : showNoteInput
                      ? "Confirm rejection"
                      : "Reject"}
                </button>
                {selected.idVerificationStatus !== "approved" && (
                  <button
                    onClick={() => submitDecision("approved")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy && !showNoteInput ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <Check size={15} />
                    )}
                    Approve & verify
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-bold text-slate-900">{selectedUser.name}</h3>
                  {selectedUser.isBanned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                      <Ban size={12} />
                      Banned
                    </span>
                  )}
                  {(() => {
                    const meta =
                      STATUS_META[selectedUser.idVerificationStatus] || STATUS_META.none;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}
                      >
                        <meta.Icon size={12} />
                        {meta.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{selectedUser.universityEmail}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {selectedUser.idVerificationNote && (
                <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                  Rejection note: {selectedUser.idVerificationNote}
                </div>
              )}

              {selectedUser.isBanned && (
                <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                  Banned {formatDate(selectedUser.bannedAt)} · {selectedUser.banReason}
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {selectedUser.profilePhoto ? (
                    <img
                      src={selectedUser.profilePhoto}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User size={32} className="text-slate-300" />
                  )}
                </div>
                {selectedUser.studentIdCard && (
                  <img
                    src={selectedUser.studentIdCard}
                    alt="University ID card"
                    className="h-24 w-40 rounded-xl border border-slate-200 object-cover"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailBlock title="Basic information" icon={User}>
                  <InfoRow label="Student ID" value={selectedUser.studentId} />
                  <InfoRow label="Full name" value={selectedUser.name} />
                  <InfoRow label="Date of birth" value={formatDate(selectedUser.dateOfBirth)} />
                </DetailBlock>

                <DetailBlock title="Academic details" icon={GraduationCap}>
                  <InfoRow label="Department" value={selectedUser.department} />
                  <InfoRow label="Year" value={selectedUser.year} />
                  <InfoRow label="Joined" value={formatDate(selectedUser.createdAt)} />
                </DetailBlock>

                <DetailBlock title="Contact & home" icon={Phone}>
                  <InfoRow label="Phone" value={selectedUser.phone} />
                  <InfoRow label="Home area" value={selectedUser.homeArea} />
                </DetailBlock>

                <DetailBlock title="Identity documents" icon={Fingerprint}>
                  <InfoRow label="NID" value={selectedUser.studentNid} />
                  <InfoRow label="Passport" value={selectedUser.passport} />
                </DetailBlock>

                <DetailBlock title="Emergency contact" icon={MapPin}>
                  <InfoRow label="Name" value={selectedUser.emergencyContact?.name} />
                  <InfoRow label="Relation" value={selectedUser.emergencyContact?.relation} />
                  <InfoRow label="Phone" value={selectedUser.emergencyContact?.phone} />
                </DetailBlock>

                <DetailBlock title="Parent's information" icon={Home}>
                  <InfoRow label="Father" value={selectedUser.parentInfo?.fatherName} />
                  <InfoRow label="Father phone" value={selectedUser.parentInfo?.fatherPhone} />
                  <InfoRow label="Mother" value={selectedUser.parentInfo?.motherName} />
                  <InfoRow label="Mother phone" value={selectedUser.parentInfo?.motherPhone} />
                </DetailBlock>
              </div>

              {selectedUser.localGuardian &&
                (selectedUser.localGuardian.name ||
                  selectedUser.localGuardian.phone ||
                  selectedUser.localGuardian.address) && (
                  <DetailBlock title="Local guardian" icon={Home}>
                    <InfoRow label="Name" value={selectedUser.localGuardian?.name} />
                    <InfoRow label="Relation" value={selectedUser.localGuardian?.relation} />
                    <InfoRow label="Date of birth" value={formatDate(selectedUser.localGuardian?.dateOfBirth)} />
                    <InfoRow label="NID" value={selectedUser.localGuardian?.nid} />
                    <InfoRow label="Phone" value={selectedUser.localGuardian?.phone} />
                    <InfoRow label="Address" value={selectedUser.localGuardian?.address} />
                  </DetailBlock>
                )}

              {/* Student Ride History Section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
                    <History size={14} className="text-blue-600" />
                    Student Ride History
                  </p>
                  {!userRides && (
                    <button
                      onClick={() => loadUserRides(selectedUser._id)}
                      disabled={userRidesLoading}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {userRidesLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                      Load ride history
                    </button>
                  )}
                </div>

                {userRides && (
                  <div className="mt-3 space-y-3">
                    <div className="flex gap-2 border-b border-slate-200 pb-2">
                      <button
                        onClick={() => setUserRidesView("driver")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          userRidesView === "driver" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        As Driver ({userRides.asDriver?.length || 0})
                      </button>
                      <button
                        onClick={() => setUserRidesView("passenger")}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          userRidesView === "passenger" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        As Passenger ({userRides.asPassenger?.length || 0})
                      </button>
                    </div>

                    {userRidesView === "driver" ? (
                      userRides.asDriver?.length === 0 ? (
                        <p className="text-xs text-slate-400">No rides posted by this student yet.</p>
                      ) : (
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {userRides.asDriver.map((r) => (
                            <div key={r._id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-2xs">
                              <div className="flex items-center justify-between font-semibold text-slate-800">
                                <span>{r.pickup} → {r.dropoff}</span>
                                <span className="text-blue-600 font-bold">{formatTime12Hour(r.departureTime)}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                                <span>{formatDate(r.createdAt)}</span>
                                <span>Passengers: {r.passengers?.length || 0} / {r.seats} seats</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : userRides.asPassenger?.length === 0 ? (
                      <p className="text-xs text-slate-400">No rides booked by this student yet.</p>
                    ) : (
                      <div className="max-h-48 space-y-2 overflow-y-auto">
                        {userRides.asPassenger.map((r) => (
                          <div key={r._id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-2xs">
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span>{r.pickup} → {r.dropoff}</span>
                              <span className="capitalize font-bold text-slate-600">{r.bookingStatus}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                              <span>Driver: {r.driver?.name || "Student"} ({r.driver?.phone || "—"})</span>
                              <span>{formatDate(r.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
              {selectedUser.isBanned ? (
                <button
                  onClick={() => openAction(selectedUser, "unban")}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  <CircleCheck size={15} />
                  Unban student
                </button>
              ) : (
                <button
                  onClick={() => openAction(selectedUser, "ban")}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  <Ban size={15} />
                  Ban student
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserRides(null);
                }}
                className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
            <h3 className="text-base font-bold text-slate-900">
              {actionTarget.mode === "ban"
                ? `Ban ${actionTarget.student.name}?`
                : `Unban ${actionTarget.student.name}?`}
            </h3>
            {actionTarget.mode === "ban" ? (
              <>
                <p className="mt-1.5 text-sm text-slate-500">
                  They will be blocked from signing in and using the app until unbanned.
                </p>
                <label className="mb-1 mt-4 block text-xs font-semibold text-slate-600">
                  Reason
                </label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. Fake account creation / breaking the rules"
                />
              </>
            ) : (
              <p className="mt-1.5 text-sm text-slate-500">
                They will be allowed to sign in and use the app again.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setActionTarget(null)}
                disabled={actionBusy}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={actionBusy}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  actionTarget.mode === "ban" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {actionBusy && <Loader2 className="animate-spin" size={15} />}
                {actionBusy
                  ? "Saving..."
                  : actionTarget.mode === "ban"
                    ? "Ban student"
                    : "Unban student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
