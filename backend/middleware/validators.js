const { body, validationResult } = require("express-validator");
const {
  YEAR_OPTIONS,
  PHONE_REGEX,
  STUDENT_ID_REGEX,
  NID_REGEX,
  PASSPORT_REGEX,
} = require("../models/Student");
const { deleteUploadedFile } = require("../utils/file");

const dobRules = (value) => {
  if (new Date(value) > new Date()) {
    throw new Error("Date of birth cannot be in the future");
  }
  return true;
};

const nidYearMatches = (nid, dob) => {
  if (!dob) return true;
  return nid.slice(0, 4) === String(new Date(dob).getFullYear());
};

const validateProfile = [
  body("studentId").trim().matches(STUDENT_ID_REGEX).withMessage("Student ID must be 8 digits"),
  body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2-100 characters"),
  body("department").trim().notEmpty().withMessage("Department is required"),
  body("year").isIn(YEAR_OPTIONS).withMessage("Select a valid academic year"),
  body("homeArea").trim().notEmpty().withMessage("Home area is required"),
  body("phone").trim().matches(PHONE_REGEX).withMessage("Enter a valid Bangladeshi mobile number"),
  body("emergencyContact.name").trim().notEmpty().withMessage("Emergency contact name is required"),
  body("emergencyContact.relation").trim().notEmpty().withMessage("Emergency contact relation is required"),
  body("emergencyContact.phone")
    .trim()
    .matches(PHONE_REGEX)
    .withMessage("Enter a valid Bangladeshi mobile number"),
  body("dateOfBirth").isISO8601({ strict: true }).withMessage("Enter a valid date of birth").custom(dobRules),
  body("studentNid")
    .optional({ values: "falsy" })
    .trim()
    .matches(NID_REGEX)
    .withMessage("Student NID must be 17 digits")
    .custom((value, { req }) => {
      if (!nidYearMatches(value, req.body.dateOfBirth)) {
        throw new Error("NID first 4 digits must match your year of birth");
      }
      return true;
    }),
  body("passport")
    .optional({ values: "falsy" })
    .trim()
    .toUpperCase()
    .matches(PASSPORT_REGEX)
    .withMessage("Enter a valid passport number (e.g. AB1234567)"),
  body("parentInfo.fatherName").trim().isLength({ min: 2, max: 100 }).withMessage("Father's name is required"),
  body("parentInfo.fatherPhone").trim().matches(PHONE_REGEX).withMessage("Enter a valid Bangladeshi mobile number"),
  body("parentInfo.motherName").trim().isLength({ min: 2, max: 100 }).withMessage("Mother's name is required"),
  body("parentInfo.motherPhone").trim().matches(PHONE_REGEX).withMessage("Enter a valid Bangladeshi mobile number"),
  body("localGuardian.name")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Local guardian name is required"),
  body("localGuardian.relation")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Local guardian relation is required"),
  body("localGuardian.phone")
    .optional({ values: "falsy" })
    .trim()
    .matches(PHONE_REGEX)
    .withMessage("Enter a valid Bangladeshi mobile number"),
  body("localGuardian.address")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Local guardian address is required"),
  body("localGuardian.nid")
    .optional({ values: "falsy" })
    .trim()
    .matches(NID_REGEX)
    .withMessage("NID must be 17 digits"),
  body("localGuardian.dateOfBirth")
    .optional({ values: "falsy" })
    .isISO8601({ strict: true })
    .withMessage("Enter a valid date of birth")
    .custom(dobRules),
  body("localGuardian")
    .optional({ values: "falsy" })
    .custom((value) => {
      if (value && value.nid && value.dateOfBirth && !nidYearMatches(value.nid, value.dateOfBirth)) {
        throw new Error("NID first 4 digits must match the guardian's year of birth");
      }
      return true;
    }),
];

const parseProfileBody = (req, res, next) => {
  try {
    if (typeof req.body.profile === "string" && req.body.profile.length > 0) {
      req.body = JSON.parse(req.body.profile);
    }
    next();
  } catch (err) {
    if (req.file) deleteUploadedFile(req.file.path);
    return res.status(400).json({ success: false, message: "Invalid profile data" });
  }
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) deleteUploadedFile(req.file.path);
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

module.exports = { validateProfile, handleValidation, parseProfileBody };
