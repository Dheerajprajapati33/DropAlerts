import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  registerDevice,
  getSelfDevice,
  listDevices,
  deviceDetail,
  generatePairCode,
  pairDevice,
  updateDevice,
  unpairDevice,
  pingDevice,
  updateToken,
  updateSettings,
  pairedDevices,
} from '../controllers/deviceController.js';

const r = Router();
r.use(auth);

r.get('/', listDevices);
r.get('/self', getSelfDevice);
r.post('/', registerDevice);
r.post('/pair-code', generatePairCode);
r.post('/pair', pairDevice);
r.get('/:id', deviceDetail);
r.patch('/:id', updateDevice);
r.delete('/:id', unpairDevice);
r.post('/:id/ping', pingDevice);
r.patch('/:id/fcm-token', updateToken);
r.patch('/:id/settings', updateSettings);
r.get('/:id/paired', pairedDevices);

export default r;
