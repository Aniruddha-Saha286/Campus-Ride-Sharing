const cloudinary = require("./cloudinary");

const extractPublicId = (url) => {
  if (!url || !url.includes("res.cloudinary.com")) return null;
  const parts = url.split("/upload/");
  if (parts.length < 2) return null;
  const withoutVersion = parts[1].replace(/^v\d+\//, "");
  return withoutVersion.replace(/\.[^.]+$/, "");
};

const deleteUploadedFile = async (urlOrPath) => {
  if (!urlOrPath) return;
  const publicId = extractPublicId(urlOrPath);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Failed to delete Cloudinary asset:", err.message);
  }
};

module.exports = { deleteUploadedFile };
