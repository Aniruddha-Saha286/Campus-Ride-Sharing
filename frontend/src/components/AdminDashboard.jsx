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
} from "lucide-react";
import {
  getVerifications,
  reviewVerification,
  getUsers,
  getAdminStats,
  banUser,
  unbanUser,
} from "../api/api";


const STATUS_META = {
  none: { label: "Not submitted", classes: "bg-slate-100 text-slate-600", Icon: ShieldCheck },
  pending: { label: "Pending", classes: "bg-amber-50 text-amber-700", Icon: Clock3 },
  approved: { label: "Verified", classes: "bg-emerald-50 text-emerald-700", Icon: BadgeCheck },
  rejected: { label: "Rejected", classes: "bg-rose-50 text-rose-700", Icon: XCircle },
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

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filter]);

  useEffect(() => {
    if (tab !== "users") return;
    const timer = setTimeout(() => loadUsers(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

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

        <div className="mb-6 flex gap-2">
          {tabButton("verifications", "ID Verification", <ShieldCheck size={15} />)}
          {tabButton("users", "Users", <Users size={15} />)}
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex flex-1 min-w-[200px] items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
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
        ) : (
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
                          onClick={() => setSelectedUser(student)}
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
                onClick={() => setSelectedUser(null)}
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
