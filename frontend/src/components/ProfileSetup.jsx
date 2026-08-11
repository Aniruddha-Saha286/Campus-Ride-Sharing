import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import {
  User,
  GraduationCap,
  MapPin,
  Phone,
  ShieldAlert,
  Camera,
  ArrowLeft,
  Loader2,
  BadgeCheck,
  X,
  Users,
  Home,
  Fingerprint,
  CreditCard,
  Clock3,
  XCircle,
} from "lucide-react";
import {
  getMyProfile,
  createProfile,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadStudentIdCard,
  deleteAccount,
} from "../api/api";
import { useAuth } from "../auth";
import { FieldError, Section, TextInput, DateInput, SelectInput } from "./Fields.jsx";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Graduate"];
const RELATION_OPTIONS = ["Parent", "Guardian", "Sibling", "Relative", "Friend", "Other"];
const TODAY = new Date().toISOString().slice(0, 10);
const toDateString = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const phonePattern = /^(\+?8801[3-9]\d{8}|01[3-9]\d{8})$/;
const studentIdPattern = /^\d{8}$/;
const nidPattern = /^\d{17}$/;
const passportPattern = /^[A-Za-z]{1,2}\d{6,8}$/;

const emptyForm = {
  studentId: "",
  name: "",
  department: "",
  year: "",
  homeArea: "",
  phone: "",
  dateOfBirth: "",
  studentNid: "",
  passport: "",
  emergencyContact: { name: "", relation: "", phone: "" },
  parentInfo: { fatherName: "", fatherPhone: "", motherName: "", motherPhone: "" },
  localGuardian: { name: "", relation: "", dateOfBirth: "", phone: "", address: "", nid: "" },
};

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { handleLogout } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardPreview, setIdCardPreview] = useState(null);
  const [idCardUrl, setIdCardUrl] = useState(null);
  const [idVerificationStatus, setIdVerificationStatus] = useState("none");
  const [idVerificationNote, setIdVerificationNote] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);
  const idCardInputRef = useRef(null);
  const skipLeaveRef = useRef(false);
  const initialFormRef = useRef(JSON.stringify(emptyForm));
  const initialPhotoRef = useRef(null);

  const API_ORIGIN = new URL(
    import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  ).origin;

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyProfile();
        const data = res.data.data;
        const loadedForm = {
          studentId: data.studentId || "",
          name: data.name || "",
          department: data.department || "",
          year: data.year || "",
          homeArea: data.homeArea || "",
          phone: data.phone || "",
          dateOfBirth: toDateString(data.dateOfBirth),
          studentNid: data.studentNid || "",
          passport: data.passport || "",
          emergencyContact: {
            name: data.emergencyContact?.name || "",
            relation: data.emergencyContact?.relation || "",
            phone: data.emergencyContact?.phone || "",
          },
          parentInfo: {
            fatherName: data.parentInfo?.fatherName || "",
            fatherPhone: data.parentInfo?.fatherPhone || "",
            motherName: data.parentInfo?.motherName || "",
            motherPhone: data.parentInfo?.motherPhone || "",
          },
          localGuardian: {
            name: data.localGuardian?.name || "",
            relation: data.localGuardian?.relation || "",
            dateOfBirth: toDateString(data.localGuardian?.dateOfBirth),
            phone: data.localGuardian?.phone || "",
            address: data.localGuardian?.address || "",
            nid: data.localGuardian?.nid || "",
          },
        };
        setForm(loadedForm);
        initialFormRef.current = JSON.stringify(loadedForm);
        if (data.profilePhoto) {
          const photoUrl = `${API_ORIGIN}/${data.profilePhoto}`;
          setExistingPhotoUrl(photoUrl);
          initialPhotoRef.current = photoUrl;
        }
        if (data.studentIdCard) {
          setIdCardUrl(`${API_ORIGIN}/${data.studentIdCard}`);
        }
        setIdVerificationStatus(data.idVerificationStatus || "none");
        setIdVerificationNote(data.idVerificationNote || null);
        setHasProfile(true);
      } catch (err) {
        if (err.response?.status === 401) {
          handleLogout();
        } else if (err.response?.status !== 404) {
          setServerError(
            err.response?.data?.message || "Could not load your profile. Please refresh.",
          );
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completion = (() => {
    const fields = [
      form.studentId,
      form.name,
      form.department,
      form.year,
      form.homeArea,
      form.phone,
      form.dateOfBirth,
      form.emergencyContact.name,
      form.emergencyContact.relation,
      form.emergencyContact.phone,
      form.parentInfo.fatherName,
      form.parentInfo.fatherPhone,
      form.parentInfo.motherName,
      form.parentInfo.motherPhone,
    ];
    const filled = fields.filter((f) => f && f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  })();

  const hasChanges =
    JSON.stringify(form) !== initialFormRef.current ||
    Boolean(photoFile) ||
    Boolean(idCardFile) ||
    existingPhotoUrl !== initialPhotoRef.current;

  const blocker = useBlocker(
    React.useCallback(() => hasChanges && !skipLeaveRef.current, [hasChanges]),
  );

  const confirmLeave = () => {
    if (blocker.state === "blocked") blocker.proceed();
  };

  const cancelLeave = () => {
    if (blocker.state === "blocked") blocker.reset();
  };

  const navigateToDashboard = () => navigate("/dashboard");

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleNestedChange = (group, field, value) => {
    setForm((prev) => ({
      ...prev,
      [group]: { ...prev[group], [field]: value },
    }));
    setErrors((prev) => ({ ...prev, [`${group}.${field}`]: null }));
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: "Use a JPG, PNG, or WEBP image" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: "Image must be under 5MB" }));
      return;
    }
    setErrors((prev) => ({ ...prev, photo: null }));
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearPhoto = async () => {
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoFile(null);
    if (existingPhotoUrl) {
      try {
        await deleteProfilePhoto();
      } catch (err) {
        /* non-fatal */
      }
      setExistingPhotoUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleIdCardSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((prev) => ({ ...prev, idCard: "Use a JPG, PNG, or WEBP image" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, idCard: "Image must be under 5MB" }));
      return;
    }
    setErrors((prev) => ({ ...prev, idCard: null }));
    setIdCardFile(file);
    setIdCardPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearIdCard = () => {
    setIdCardPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIdCardFile(null);
    if (idCardInputRef.current) idCardInputRef.current.value = "";
  };

  const validate = () => {
    const next = {};
    if (!studentIdPattern.test(form.studentId))
      next.studentId = "Enter a valid 8-digit student ID";
    if (form.name.trim().length < 2) next.name = "Enter your full name";
    if (!form.department.trim()) next.department = "Department is required";
    if (!form.year) next.year = "Select your academic year";
    if (!form.homeArea.trim()) next.homeArea = "Home area is required";
    if (!phonePattern.test(form.phone))
      next.phone = "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)";
    if (!form.emergencyContact.name.trim()) next["emergencyContact.name"] = "Required";
    if (!form.emergencyContact.relation) next["emergencyContact.relation"] = "Select a relation";
    if (!phonePattern.test(form.emergencyContact.phone))
      next["emergencyContact.phone"] = "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)";
    if (!form.dateOfBirth) {
      next.dateOfBirth = "Enter your date of birth";
    } else if (new Date(form.dateOfBirth) > new Date()) {
      next.dateOfBirth = "Date of birth cannot be in the future";
    }
    if (form.studentNid) {
      if (!nidPattern.test(form.studentNid)) {
        next.studentNid = "Student NID must be 17 digits";
      } else if (
        form.dateOfBirth &&
        form.studentNid.slice(0, 4) !== String(new Date(form.dateOfBirth).getFullYear())
      ) {
        next.studentNid = "NID first 4 digits must match your year of birth";
      }
    }
    if (form.passport && !passportPattern.test(form.passport)) {
      next.passport = "Enter a valid passport number (e.g. AB1234567)";
    }
    if (!hasProfile && !idCardFile) {
      next.idCard = "Upload your university ID card to create your account";
    }
    if (form.parentInfo.fatherName.trim().length < 2) next["parentInfo.fatherName"] = "Required";
    if (!phonePattern.test(form.parentInfo.fatherPhone))
      next["parentInfo.fatherPhone"] = "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)";
    if (form.parentInfo.motherName.trim().length < 2) next["parentInfo.motherName"] = "Required";
    if (!phonePattern.test(form.parentInfo.motherPhone))
      next["parentInfo.motherPhone"] = "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)";
    const guardian = form.localGuardian;
    if (guardian.name.trim() && guardian.name.trim().length < 2) next["localGuardian.name"] = "Required";
    if (guardian.relation.trim() && guardian.relation.trim().length < 2) next["localGuardian.relation"] = "Required";
    if (guardian.dateOfBirth && new Date(guardian.dateOfBirth) > new Date())
      next["localGuardian.dateOfBirth"] = "Date of birth cannot be in the future";
    if (guardian.phone.trim() && !phonePattern.test(guardian.phone))
      next["localGuardian.phone"] = "Enter a valid Bangladeshi mobile number (e.g. 017XXXXXXXX)";
    if (guardian.address.trim() && guardian.address.trim().length < 2)
      next["localGuardian.address"] = "Address is required";
    if (guardian.nid) {
      if (!nidPattern.test(guardian.nid)) {
        next["localGuardian.nid"] = "NID must be 17 digits";
      } else if (
        guardian.dateOfBirth &&
        guardian.nid.slice(0, 4) !== String(new Date(guardian.dateOfBirth).getFullYear())
      ) {
        next["localGuardian.nid"] = "NID first 4 digits must match the year of birth";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = { ...form };
      let idCardHandled = false;

      try {
        await updateProfile(payload);
      } catch (err) {
        if (err.response?.status === 404) {
          const cardRes = await createProfile(payload, idCardFile);
          if (cardRes.data?.data?.studentIdCard) {
            setIdCardUrl(`${API_ORIGIN}/${cardRes.data.data.studentIdCard}`);
          }
          setIdVerificationStatus(cardRes.data?.data?.idVerificationStatus || "pending");
          setIdVerificationNote(cardRes.data?.data?.idVerificationNote || null);
          setIdCardFile(null);
          setIdCardPreview(null);
          if (idCardInputRef.current) idCardInputRef.current.value = "";
          idCardHandled = true;
        } else {
          throw err;
        }
      }

      let newPhotoUrl = existingPhotoUrl;
      if (photoFile) {
        const photoRes = await uploadProfilePhoto(photoFile);
        if (photoRes.data?.data?.profilePhoto) {
          newPhotoUrl = `${API_ORIGIN}/${photoRes.data.data.profilePhoto}`;
          setExistingPhotoUrl(newPhotoUrl);
        }
        setPhotoFile(null);
        setPhotoPreview(null);
      }

      if (!idCardHandled && idCardFile) {
        const cardRes = await uploadStudentIdCard(idCardFile);
        if (cardRes.data?.data?.studentIdCard) {
          setIdCardUrl(`${API_ORIGIN}/${cardRes.data.data.studentIdCard}`);
        }
        setIdVerificationStatus(cardRes.data?.data?.idVerificationStatus || "pending");
        setIdVerificationNote(cardRes.data?.data?.idVerificationNote || null);
        setIdCardFile(null);
        setIdCardPreview(null);
        if (idCardInputRef.current) idCardInputRef.current.value = "";
      }

      initialFormRef.current = JSON.stringify(form);
      initialPhotoRef.current = newPhotoUrl;
      skipLeaveRef.current = true;
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setServerError(
          err.response?.data?.message || "Something went wrong. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setServerError("");
    try {
      await deleteAccount();
      handleLogout();
    } catch (err) {
      setServerError(
        err.response?.data?.message || "Could not delete your account.",
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const avatarSrc = photoPreview || existingPhotoUrl;
  const cardSrc = idCardPreview || idCardUrl;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          {hasProfile ? (
            <button
              onClick={navigateToDashboard}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand-700"
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 transition hover:text-rose-500"
          >
            Log out
          </button>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {hasProfile ? "Edit profile" : "Set up your profile"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          This builds trust with the students you'll be riding with.
        </p>
      </div>

      <div className="mb-8">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Profile completeness</span>
          <span className={completion === 100 ? "text-emerald-600" : "text-brand-600"}>
            {completion}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completion === 100
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-brand-400 to-brand-600"
            }`}
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-card sm:p-8">
        <form onSubmit={handleSubmit}>
          <div className="mb-8 flex flex-col items-center">
            <div className="group relative">
              <div
                className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 shadow-sm ${
                  avatarSrc ? "border-brand-200" : "border-dashed border-slate-300 bg-slate-50"
                }`}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="text-slate-300" size={40} />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700"
                title="Upload photo"
              >
                <Camera size={16} />
              </button>
              {avatarSrc && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition hover:bg-rose-600"
                  title="Remove photo"
                >
                  <X size={13} />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">JPG, PNG or WEBP · up to 5MB</p>
            <FieldError message={errors.photo} />
          </div>

          <div className="mb-8 rounded-xl border border-slate-100 bg-slate-50/60 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <CreditCard size={18} strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-800">
                  University ID verification
                  {!hasProfile && (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                      Required
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Upload your university ID card. An admin reviews it and approval unlocks your
                  verified badge, confirming you're a genuine member of the campus community.
                </p>

                <div className="mt-3">
                  {idVerificationStatus === "approved" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck size={14} />
                      Verified
                    </span>
                  ) : idVerificationStatus === "pending" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <Clock3 size={14} />
                      Under review
                    </span>
                  ) : idVerificationStatus === "rejected" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      <XCircle size={14} />
                      Rejected
                    </span>
                  ) : null}
                  {idVerificationNote && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                      Reason: {idVerificationNote}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  {cardSrc ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={cardSrc}
                        alt="University ID card"
                        className="h-24 w-40 rounded-lg border border-slate-200 bg-white object-cover shadow-sm"
                      />
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => idCardInputRef.current?.click()}
                          className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
                        >
                          {idCardFile ? "Replace" : "Upload another"}
                        </button>
                        <button
                          type="button"
                          onClick={clearIdCard}
                          className="block rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => idCardInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-sm font-semibold text-slate-500 transition hover:border-brand-400 hover:text-brand-700"
                    >
                      <Camera size={16} />
                      {idCardFile ? "Replace selected card" : "Upload university ID card"}
                    </button>
                  )}
                  <input
                    ref={idCardInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleIdCardSelect}
                  />
                  <FieldError message={errors.idCard} />
                  {idCardFile && (
                    <p className="mt-2 text-xs font-medium text-brand-600">
                      New card selected — it will be uploaded when you save.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <fieldset>
            <Section icon={User} title="Basic information" subtitle="How other students will see you">
              <TextInput
                label="Full name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. Anisha Rahman"
                error={errors.name}
              />
              <DateInput
                label="Date of birth"
                max={TODAY}
                value={form.dateOfBirth}
                onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                error={errors.dateOfBirth}
              />
            </Section>

            <Section
              icon={GraduationCap}
              title="Academic details"
              subtitle="Student ID, department and current year"
            >
              <TextInput
                label="Student ID"
                inputMode="numeric"
                maxLength={8}
                value={form.studentId}
                onChange={(e) => handleChange("studentId", e.target.value)}
                placeholder="e.g. 20101234"
                error={errors.studentId}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="Department"
                  value={form.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  placeholder="e.g. CSE"
                  error={errors.department}
                />
                <SelectInput
                  label="Year"
                  value={form.year}
                  onChange={(e) => handleChange("year", e.target.value)}
                  error={errors.year}
                >
                  <option value="">Select year</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </Section>

            <Section
              icon={Fingerprint}
              title="Identity documents (optional)"
              subtitle="Provide your Bangladesh NID or passport — foreign students can use their passport"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="National ID (NID)"
                  inputMode="numeric"
                  maxLength={17}
                  value={form.studentNid}
                  onChange={(e) => handleChange("studentNid", e.target.value)}
                  error={errors.studentNid}
                />
                <TextInput
                  label="Passport number"
                  value={form.passport}
                  onChange={(e) => handleChange("passport", e.target.value)}
                  error={errors.passport}
                />
              </div>
            </Section>

            <Section icon={MapPin} title="Home area" subtitle="Only revealed to a match after a request is accepted">
              <TextInput
                value={form.homeArea}
                onChange={(e) => handleChange("homeArea", e.target.value)}
                placeholder="e.g. Mirpur 10, Dhaka"
                error={errors.homeArea}
              />
            </Section>

            <Section icon={Phone} title="Contact number" subtitle="Kept private until a ride is confirmed">
              <TextInput
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="e.g. 017XXXXXXXXX"
                error={errors.phone}
              />
            </Section>

            <Section icon={ShieldAlert} title="Emergency contact" subtitle="Used only in a safety situation">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="Contact name"
                  value={form.emergencyContact.name}
                  onChange={(e) => handleNestedChange("emergencyContact", "name", e.target.value)}
                  placeholder="e.g. Rafiul Hasan"
                  error={errors["emergencyContact.name"]}
                />
                <SelectInput
                  label="Relation"
                  value={form.emergencyContact.relation}
                  onChange={(e) => handleNestedChange("emergencyContact", "relation", e.target.value)}
                  error={errors["emergencyContact.relation"]}
                >
                  <option value="">Select relation</option>
                  {RELATION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </SelectInput>
                <TextInput
                  className="sm:col-span-2"
                  label="Contact phone"
                  type="tel"
                  value={form.emergencyContact.phone}
                  onChange={(e) => handleNestedChange("emergencyContact", "phone", e.target.value)}
                  placeholder="e.g. 017XXXXXXXXX"
                  error={errors["emergencyContact.phone"]}
                />
              </div>
            </Section>

            <Section
              icon={Users}
              title="Parent's information"
              subtitle="Used for account and emergency verification"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="Father's name"
                  value={form.parentInfo.fatherName}
                  onChange={(e) => handleNestedChange("parentInfo", "fatherName", e.target.value)}
                  placeholder="e.g. Abdul Rahman"
                  error={errors["parentInfo.fatherName"]}
                />
                <TextInput
                  label="Father's phone"
                  type="tel"
                  value={form.parentInfo.fatherPhone}
                  onChange={(e) => handleNestedChange("parentInfo", "fatherPhone", e.target.value)}
                  placeholder="e.g. 017XXXXXXXXX"
                  error={errors["parentInfo.fatherPhone"]}
                />
                <TextInput
                  label="Mother's name"
                  value={form.parentInfo.motherName}
                  onChange={(e) => handleNestedChange("parentInfo", "motherName", e.target.value)}
                  placeholder="e.g. Salma Rahman"
                  error={errors["parentInfo.motherName"]}
                />
                <TextInput
                  label="Mother's phone"
                  type="tel"
                  value={form.parentInfo.motherPhone}
                  onChange={(e) => handleNestedChange("parentInfo", "motherPhone", e.target.value)}
                  placeholder="e.g. 017XXXXXXXXX"
                  error={errors["parentInfo.motherPhone"]}
                />
              </div>
            </Section>

            <Section
              icon={Home}
              title="Local guardian (optional)"
              subtitle="Someone near campus who can be reached in emergencies"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextInput
                  label="Guardian name"
                  value={form.localGuardian.name}
                  onChange={(e) => handleNestedChange("localGuardian", "name", e.target.value)}
                  placeholder="e.g. Kamal Hossain"
                  error={errors["localGuardian.name"]}
                />
                <TextInput
                  label="Relation"
                  value={form.localGuardian.relation}
                  onChange={(e) => handleNestedChange("localGuardian", "relation", e.target.value)}
                  placeholder="e.g. Uncle, Aunt, Guardian"
                  error={errors["localGuardian.relation"]}
                />
                <DateInput
                  label="Date of birth"
                  max={TODAY}
                  value={form.localGuardian.dateOfBirth}
                  onChange={(e) => handleNestedChange("localGuardian", "dateOfBirth", e.target.value)}
                  error={errors["localGuardian.dateOfBirth"]}
                />
                <TextInput
                  label="NID number"
                  inputMode="numeric"
                  maxLength={17}
                  value={form.localGuardian.nid}
                  onChange={(e) => handleNestedChange("localGuardian", "nid", e.target.value)}
                  error={errors["localGuardian.nid"]}
                />
                <TextInput
                  className="sm:col-span-2"
                  label="Phone"
                  type="tel"
                  value={form.localGuardian.phone}
                  onChange={(e) => handleNestedChange("localGuardian", "phone", e.target.value)}
                  placeholder="e.g. 017XXXXXXXXX"
                  error={errors["localGuardian.phone"]}
                />
                <TextInput
                  className="sm:col-span-2"
                  label="Address"
                  value={form.localGuardian.address}
                  onChange={(e) => handleNestedChange("localGuardian", "address", e.target.value)}
                  placeholder="e.g. House 12, Road 7, Uttara, Dhaka"
                  error={errors["localGuardian.address"]}
                />
              </div>
            </Section>
          </fieldset>

          {serverError && (
            <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
              {serverError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
            {hasProfile && (
              <button
                type="button"
                onClick={navigateToDashboard}
                className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="animate-spin" size={16} />}
              {saving ? "Saving..." : hasProfile ? "Save changes" : "Save profile"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <BadgeCheck size={14} className="text-brand-400" />
        Your ID verification badge unlocks after an admin reviews your uploaded student card.
      </div>

      {hasProfile && (
        <div className="mt-8 rounded-2xl border border-rose-100 bg-white p-6 shadow-card">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
            >
              Delete account
            </button>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-800">Are you sure?</p>
              <p className="mt-1 text-xs text-slate-500">
                This permanently deletes your account and profile photo. You can sign up again later
                with the same Google account.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting && <Loader2 className="animate-spin" size={16} />}
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h3 className="text-base font-bold text-slate-900">Discard changes?</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              You have unsaved changes. Leave without saving?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={cancelLeave}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
              >
                Stay
              </button>
              <button
                onClick={confirmLeave}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
