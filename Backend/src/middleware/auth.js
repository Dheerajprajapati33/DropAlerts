import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/http.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new Error();
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    next(new HttpError(401, 'Unauthorized'));
  }
}

export function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (token) {
      req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    } else {
      req.userId = null;
    }
  } catch {
    req.userId = null;
  }
  next();
}
