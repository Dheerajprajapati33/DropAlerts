import { validationResult } from "express-validator";
import { HttpError } from "../utils/http.js";
export const validate = (req, res, next) => {
  const e = validationResult(req);
  if (!e.isEmpty())
    return next(
      new HttpError(
        400,
        e
          .array()
          .map((x) => x.msg)
          .join("; "),
      ),
    );
  next();
};
