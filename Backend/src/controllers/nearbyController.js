import NearbyPresence from '../models/NearbyPresence.js';
import { sendPush } from '../services/push.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const EARTH_RADIUS_METERS = 6371000;
const ALLOWED_INCIDENT_TYPES = ['fall', 'sos', 'emergency'];

function parseCoords(rawLat, rawLng) {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new HttpError(400, 'Valid latitude (-90 to 90) is required');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new HttpError(400, 'Valid longitude (-180 to 180) is required');
  }
  return { lat, lng };
}

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

export const syncLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy, fcmToken, radiusPreferenceMeters, isActive } = req.body || {};
  const { lat, lng } = parseCoords(latitude, longitude);

  if (typeof fcmToken !== 'string' || !fcmToken.trim() || fcmToken.length > 4096) {
    throw new HttpError(400, 'Valid fcmToken is required');
  }

  await NearbyPresence.findOneAndUpdate(
    { fcmToken: fcmToken.trim() },
    {
      $set: {
        userId: req.userId || null,
        location: { type: 'Point', coordinates: [lng, lat] },
        ...(typeof accuracy === 'number' ? { accuracy } : {}),
        radiusPreferenceMeters:
          typeof radiusPreferenceMeters === 'number' && radiusPreferenceMeters > 0
            ? radiusPreferenceMeters
            : 3000,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        lastSyncedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({
    success: true,
    message: 'Location synced to 3km bystander mesh',
  });
});

export const broadcast100mSOS = asyncHandler(async (req, res) => {
  const { latitude, longitude, radiusMeters, incidentType, message, impactG, senderFcmToken } =
    req.body || {};
  const { lat, lng } = parseCoords(latitude, longitude);

  const radius =
    typeof radiusMeters === 'number' && radiusMeters > 0 ? Math.min(radiusMeters, 5000) : 3000;

  if (incidentType !== undefined && !ALLOWED_INCIDENT_TYPES.includes(incidentType)) {
    throw new HttpError(400, 'incidentType must be fall, sos, or emergency');
  }
  const resolvedType = incidentType || 'fall';
  const resolvedMessage = message
    ? String(message).trim()
    : 'Emergency assistance requested within 3km';

  const query = {
    isActive: true,
    location: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius,
      },
    },
  };

  if (typeof senderFcmToken === 'string' && senderFcmToken.trim()) {
    query.fcmToken = { $ne: senderFcmToken.trim() };
  }
  if (req.userId) {
    query.userId = { $ne: req.userId };
  }

  const nearbyNodes = await NearbyPresence.find(query).limit(200);
  const nowIso = new Date().toISOString();
  const alertId = `nearby_${Date.now()}`;
  const title =
    resolvedType === 'fall'
      ? 'Nearby Emergency: Fall Detected!'
      : 'Nearby Emergency SOS!';

  await Promise.all(
    nearbyNodes.map((node) => {
      const [nodeLng, nodeLat] = node.location.coordinates;
      const distanceMeters = calculateDistanceMeters(lat, lng, nodeLat, nodeLng);
      const approxDistStr =
        distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(1)}km`
          : `${distanceMeters}m`;
      return sendPush(node.fcmToken, title, resolvedMessage, {
        type: 'NEARBY_SOS',
        id: alertId,
        incidentType: resolvedType,
        title,
        message: resolvedMessage,
        latitude: String(lat),
        longitude: String(lng),
        distanceMeters: String(distanceMeters),
        approxLocation: `Within ~${approxDistStr} (Near your vicinity)`,
        timestamp: nowIso,
        isPaired: 'false',
        ...(impactG !== undefined ? { impactG: String(impactG) } : {}),
      });
    })
  );

  res.json({
    success: true,
    alertId,
    devicesNotified: nearbyNodes.length,
    radiusMeters: radius,
    timestamp: nowIso,
  });
});

export const getActiveCount = asyncHandler(async (req, res) => {
  const radiusRaw = Number(req.query.radiusMeters);
  const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(radiusRaw, 5000) : 3000;

  const filter = { isActive: true };
  if (req.query.latitude !== undefined && req.query.longitude !== undefined) {
    const { lat, lng } = parseCoords(req.query.latitude, req.query.longitude);
    filter.location = {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius / EARTH_RADIUS_METERS],
      },
    };
  }

  const activeCount = await NearbyPresence.countDocuments(filter);

  res.json({
    success: true,
    activeCount,
    radiusMeters: radius,
  });
});
