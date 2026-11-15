import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportFall, getFallHistory, cancelFall, acknowledgeFall } from '../controllers/fallController.js';

const r = Router();
r.use(auth);

r.post(
  '/report',
  [
    body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('invalid severity'),
    body('confidence').optional().isFloat({ min: 0, max: 1 }).withMessage('confidence must be between 0 and 1'),
    body('impactForce').optional().isFloat({ min: 0, max: 100 }).withMessage('impactForce must be between 0 and 100'),
    body('sensorData').optional().isObject().withMessage('sensorData must be an object'),
    validate,
  ],
  reportFall
);
r.get('/history', getFallHistory);
r.post('/:id/cancel', cancelFall);
r.post('/:id/acknowledge', acknowledgeFall);

export default r;
