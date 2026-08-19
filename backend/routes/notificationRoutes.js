const express = require("express");
const router = express.Router();
const { streamEvents } = require("../controllers/notificationController");

router.get("/stream", streamEvents);

module.exports = router;
