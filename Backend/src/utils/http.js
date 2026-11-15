export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export function requireFields(obj, fields) {
  for (const f of fields)
    if (typeof obj?.[f] !== "string" || !obj[f].trim())
      throw new HttpError(400, `${f} is required`);
}
