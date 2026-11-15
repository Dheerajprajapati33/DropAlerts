import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      required: true,
    },
    title: String,
    body: String,
    readAt: Date,
  },
  { timestamps: true },
);
export default mongoose.model("Notification", schema);
