import { Router } from 'express';
import { auth, optionalAuth } from '../middleware/auth.js';
import {
  registerToken,
  listNotifications,
  readNotification,
  readAllNotifications,
} from '../controllers/notificationController.js';

const r = Router();

r.post('/token', optionalAuth, registerToken);

r.use(auth);
r.get('/', listNotifications);
r.patch('/read-all', readAllNotifications);
r.patch('/:id/read', readNotification);

export default r;
