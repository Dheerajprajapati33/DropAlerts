import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { syncLocation, broadcast100mSOS, getActiveCount } from '../controllers/nearbyController.js';

const r = Router();

r.post('/location', optionalAuth, syncLocation);
r.post('/broadcast', optionalAuth, broadcast100mSOS);
r.get('/active-count', optionalAuth, getActiveCount);

export default r;
