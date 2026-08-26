const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const {
  getRideMessages,
  sendMessage,
  editMessage,
  deleteMessage,
} = require("../controllers/chatController");

router.get("/:rideId", protect, getRideMessages);
router.post("/:rideId", protect, sendMessage);
router.put("/:rideId/messages/:messageId", protect, editMessage);
router.delete("/:rideId/messages/:messageId", protect, deleteMessage);

module.exports = router;
