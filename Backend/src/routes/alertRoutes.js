import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  createAlert,
  triggerAlert,
  listAlerts,
  alertDetail,
  dismissAlert,
  cancelAlert,
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
} from '../controllers/alertController.js';

const r = Router();
r.use(auth);

r.get('/', listAlerts);
r.post('/', createAlert);
r.post('/trigger', triggerAlert);
r.get('/contacts', getEmergencyContacts);
r.post('/contacts', addEmergencyContact);
r.patch('/contacts/:id', updateEmergencyContact);
r.delete('/contacts/:id', deleteEmergencyContact);
r.post('/:id/dismiss', dismissAlert);
r.get('/:id', alertDetail);
r.patch('/:id/cancel', cancelAlert);

export default r;
