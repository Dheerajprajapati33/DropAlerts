import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  createCode,
  redeemCode,
  unpair,
} from "../controllers/pairController.js";
const r = Router();
r.use(auth);
r.post("/code", createCode);
r.post("/connect", redeemCode);
r.delete("/:id", unpair);
export default r;
