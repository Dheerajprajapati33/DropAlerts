import Device from "../models/Device.js";
import { HttpError } from "../utils/http.js";
export async function ownDevice(id, userId) {
  const device = await Device.findOne({ _id: id, owner: userId });
  if (!device) throw new HttpError(404, "Device not found");
  return device;
}
