import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  googleLogin,
  me,
  updateMe,
  logout,
  forgotPassword,
  resetPassword,
  deleteMe,
} from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const r = Router();

r.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').isLength({ min: 1, max: 80 }).withMessage('Name is required (max 80 chars)'),
    body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
    validate,
  ],
  register
);
r.post('/login', login);
r.post('/google', googleLogin);
r.post('/forgot-password', forgotPassword);
r.post('/reset-password', resetPassword);
r.post('/logout', auth, logout);
r.get('/me', auth, me);
r.put('/me', auth, updateMe);
r.patch('/me', auth, updateMe);
r.delete('/me', auth, deleteMe);

export default r;
