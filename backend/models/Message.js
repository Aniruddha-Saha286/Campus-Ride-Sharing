const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    read: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    clearedForRecipient: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ ride: 1, createdAt: 1 });
messageSchema.index({ ride: 1, sender: 1, recipient: 1 });


module.exports = mongoose.model("Message", messageSchema);
