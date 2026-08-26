const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const {
  streamEvents,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  clearAllNotifications,
  deleteNotification,
} = require("../controllers/notificationController");

router.get("/stream", streamEvents);
router.get("/", protect, listNotifications);
router.put("/read-all", protect, markAllNotificationsRead);
router.put("/:id/read", protect, markNotificationRead);
router.delete("/", protect, clearAllNotifications);
router.delete("/:id", protect, deleteNotification);

module.exports = router;
