const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../utils/cloudinary");

const allowedMimes = ["image/jpeg", "image/png", "image/webp"];

const createUpload = (folder) => {
  let storage;
  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === "mock-cloud" || process.env.NODE_ENV === "test") {
    storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, require("os").tmpdir()),
      filename: (req, file, cb) => {
        const name = `${(req.user && req.user.id) || "anon"}-${Date.now()}-${file.originalname}`;
        file.path = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${folder}/${name}`;
        cb(null, name);
      },
    });
  } else {
    storage = new CloudinaryStorage({
      cloudinary,
      params: (req, file) => ({
        folder,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        public_id: `${(req.user && req.user.id) || "anon"}-${Date.now()}`,
      }),
    });
  }

  const fileFilter = (req, file, cb) => {
    if (!allowedMimes.includes(file.mimetype)) {
      const err = new Error("Only .jpg, .jpeg, .png, or .webp images are allowed");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  };

  return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
};

module.exports = {
  uploadProfilePhoto: createUpload("profile-photos"),
  uploadIdCard: createUpload("id-cards"),
};
