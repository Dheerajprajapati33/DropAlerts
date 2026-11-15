import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';
import './config/firebase.js';
import NearbyPresence from './models/NearbyPresence.js';
import Device from './models/Device.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.MONGODB_URI) {
  console.error('Set secure JWT_SECRET (32+ chars) and MONGODB_URI');
  process.exit(1);
}

try {
  await connectDB();
  await NearbyPresence.init();

  const STALE_DEVICE_MS = Number(process.env.DEVICE_OFFLINE_MINUTES || 10) * 60 * 1000;
  const offlineCheck = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STALE_DEVICE_MS);
      await Device.updateMany(
        { isOnline: true, lastSeenAt: { $lt: cutoff } },
        { $set: { isOnline: false } }
      );
    } catch {
      // Ignore periodic offline-check errors
    }
  }, 120000);
  offlineCheck.unref();

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`FallAlert API listening on ${port}`));
} catch (e) {
  console.error('Startup failed:', e.message);
  process.exit(1);
}
