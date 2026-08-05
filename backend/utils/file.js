const fs = require("fs");
const path = require("path");

const deleteUploadedFile = async (relativePath) => {
  if (!relativePath) return;
  try {
    await fs.promises.unlink(path.join(__dirname, "..", relativePath));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Failed to delete file:", err.message);
  }
};

module.exports = { deleteUploadedFile };
