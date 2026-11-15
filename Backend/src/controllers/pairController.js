import crypto from "node:crypto";
import mongoose from "mongoose";
import PairCode from "../models/PairCode.js";
import Pairing from "../models/Pairing.js";
import Device from "../models/Device.js";
import { ownDevice } from "../services/deviceAccess.js";
import { HttpError, asyncHandler } from "../utils/http.js";
export const createCode = asyncHandler(async (req, res) => {
  const device = await ownDevice(req.body.deviceId, req.userId);
  await PairCode.deleteMany({ device: device._id });
  let code;
  for (let i = 0; i < 8; i++) {
    code = String(crypto.randomInt(0, 100000000)).padStart(8, "0");
    if (!(await PairCode.exists({ code }))) break;
  }
  const expiresAt = new Date(
    Date.now() + Number(process.env.PAIR_CODE_TTL_MINUTES || 10) * 60000,
  );
  await PairCode.create({ device: device._id, code, expiresAt });
  res
    .status(201)
    .json({
      code,
      expiresAt,
      qrPayload: JSON.stringify({ type: "fallalert_pair", version: 1, code }),
    });
});
export const redeemCode = asyncHandler(async (req, res) => {
  const local = await ownDevice(req.body.deviceId, req.userId);
  const code = String(req.body.code || "").replace(/\s/g, "");
  if (!/^\d{8}$/.test(code)) throw new HttpError(400, "Invalid code");
  const entry = await PairCode.findOneAndUpdate(
    { code, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!entry) throw new HttpError(400, "Code invalid, expired or already used");
  if (String(entry.device) === String(local._id))
    throw new HttpError(400, "Cannot pair device to itself");
  const remote = await Device.findById(entry.device);
  if (!remote) throw new HttpError(404, "Pair target unavailable");
  const [deviceA, deviceB] = [String(local._id), String(remote._id)].sort();
  const pairing = await Pairing.findOneAndUpdate(
    { deviceA, deviceB },
    { $set: { active: true } },
    { upsert: true, new: true },
  );
  res.json({
    pairingId: pairing.id,
    pairedDevice: { id: remote.id, name: remote.name },
  });
});
export const unpair = asyncHandler(async (req, res) => {
  const local = await ownDevice(req.body.deviceId, req.userId);
  const pair = await Pairing.findOne({
    _id: req.params.id,
    active: true,
    $or: [{ deviceA: local.id }, { deviceB: local.id }],
  });
  if (!pair) throw new HttpError(404, "Pairing not found");
  pair.active = false;
  await pair.save();
  res.json({ message: "Disconnected" });
});
