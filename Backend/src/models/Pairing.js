import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    deviceA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    deviceB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
schema.index({ deviceA: 1, deviceB: 1 }, { unique: true });
export default mongoose.model("Pairing", schema);
