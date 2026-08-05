const multer = require("multer");
const path = require("path");
const fs = require("fs");

const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
const allowedMimes = ["image/jpeg", "image/png", "image/webp"];

const createUpload = (subdir) => {
  const uploadDir = path.join(__dirname, "..", "uploads", subdir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const owner = (req.user && req.user.id) || "anon";
      cb(null, `${owner}-${Date.now()}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext) || !allowedMimes.includes(file.mimetype)) {
      const err = new Error("Only .jpg, .jpeg, .png, or .webp images are allowed");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
};

module.exports = {
  uploadProfilePhoto: createUpload("profile-photos"),
  uploadIdCard: createUpload("id-cards"),
};
