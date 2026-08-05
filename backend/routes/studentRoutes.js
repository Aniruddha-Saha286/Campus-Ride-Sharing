const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { uploadProfilePhoto, uploadIdCard } = require("../middleware/upload");
const { validateProfile, handleValidation, parseProfileBody } = require("../middleware/validators");
const {
  createProfile,
  getMyProfile,
  getPublicProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  uploadStudentIdCard,
  deleteProfile,
} = require("../controllers/studentController");

router.post(
  "/profile",
  protect,
  uploadIdCard.single("studentIdCard"),
  parseProfileBody,
  validateProfile,
  handleValidation,
  createProfile
);
router.get("/profile/me", protect, getMyProfile);
router.get("/:id", protect, getPublicProfile);
router.put("/profile", protect, validateProfile, handleValidation, updateProfile);
router.post("/profile/photo", protect, uploadProfilePhoto.single("profilePhoto"), uploadPhoto);
router.post("/profile/idcard", protect, uploadIdCard.single("studentIdCard"), uploadStudentIdCard);
router.delete("/profile/photo", protect, deletePhoto);
router.delete("/profile", protect, deleteProfile);

module.exports = router;
