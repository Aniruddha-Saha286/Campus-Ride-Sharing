const mongoose = require("mongoose");

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Graduate"];
const PHONE_REGEX = /^(\+?8801[3-9]\d{8}|01[3-9]\d{8})$/;
const STUDENT_ID_REGEX = /^\d{8}$/;
const NID_REGEX = /^\d{17}$/;
const PASSPORT_REGEX = /^[A-Z]{1,2}\d{6,8}$/;
const UNIVERSITY_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(g\.bracu\.ac\.bd|bracu\.ac\.bd)$/;

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    relation: { type: String, required: true, trim: true, maxlength: 50 },
    phone: { type: String, required: true, match: [PHONE_REGEX, "Enter a valid Bangladeshi mobile number"] },
  },
  { _id: false }
);

const parentInfoSchema = new mongoose.Schema(
  {
    fatherName: { type: String, required: true, trim: true, maxlength: 100 },
    fatherPhone: { type: String, required: true, match: [PHONE_REGEX, "Enter a valid Bangladeshi mobile number"] },
    motherName: { type: String, required: true, trim: true, maxlength: 100 },
    motherPhone: { type: String, required: true, match: [PHONE_REGEX, "Enter a valid Bangladeshi mobile number"] },
  },
  { _id: false }
);

const localGuardianSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    relation: { type: String, trim: true, maxlength: 50 },
    dateOfBirth: { type: Date },
    phone: { type: String, match: [PHONE_REGEX, "Enter a valid Bangladeshi mobile number"] },
    address: { type: String, trim: true, maxlength: 200 },
    nid: { type: String, match: [NID_REGEX, "NID must be 17 digits"] },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    universityEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [UNIVERSITY_EMAIL_REGEX, "Must be a valid university (GSuite) email"],
    },
    studentId: { type: String, required: true, trim: true, match: [STUDENT_ID_REGEX, "Student ID must be 8 digits"] },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    year: { type: String, required: true, enum: YEAR_OPTIONS },
    homeArea: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, match: [PHONE_REGEX, "Enter a valid Bangladeshi mobile number"] },
    emergencyContact: { type: emergencyContactSchema, required: true },
    dateOfBirth: { type: Date, required: true },
    studentNid: { type: String, default: null, trim: true, match: [NID_REGEX, "Student NID must be 17 digits"] },
    passport: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      match: [PASSPORT_REGEX, "Enter a valid passport number"],
    },
    parentInfo: { type: parentInfoSchema, required: true },
    localGuardian: { type: localGuardianSchema },
    profilePhoto: { type: String, default: null },
    profileCompleted: { type: Boolean, default: false },
    studentIdCard: { type: String, default: null },
    idVerificationStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    idVerificationNote: { type: String, default: null },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    bannedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

studentSchema.virtual("idVerified").get(function () {
  return this.idVerificationStatus === "approved";
});

const isProfileComplete = (values) =>
  Boolean(
    values &&
      values.studentId &&
      values.name &&
      values.department &&
      values.year &&
      values.homeArea &&
      values.phone &&
      values.emergencyContact &&
      values.emergencyContact.name &&
      values.emergencyContact.phone &&
      values.dateOfBirth &&
      values.parentInfo &&
      values.parentInfo.fatherName &&
      values.parentInfo.fatherPhone &&
      values.parentInfo.motherName &&
      values.parentInfo.motherPhone
  );

studentSchema.pre("save", function (next) {
  this.profileCompleted = isProfileComplete(this);
  next();
});

module.exports = mongoose.model("Student", studentSchema);
module.exports.YEAR_OPTIONS = YEAR_OPTIONS;
module.exports.PHONE_REGEX = PHONE_REGEX;
module.exports.STUDENT_ID_REGEX = STUDENT_ID_REGEX;
module.exports.NID_REGEX = NID_REGEX;
module.exports.PASSPORT_REGEX = PASSPORT_REGEX;
module.exports.isProfileComplete = isProfileComplete;
