import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_that_is_at_least_32_characters_long';

const { default: app } = await import('../src/app.js');
const { calculateDistanceMeters } = await import('../src/controllers/nearbyController.js');
const { deriveFallSeverity, sanitizeSensorData } = await import('../src/controllers/fallController.js');
const User = (await import('../src/models/User.js')).default;
const Device = (await import('../src/models/Device.js')).default;
const PairCode = (await import('../src/models/PairCode.js')).default;

function startTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('Health endpoints work on both /api/v1/health and /api/health', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const r1 = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(r1.status, 200);
    const j1 = await r1.json();
    assert.equal(j1.success, true);

    const r2 = await fetch(`${baseUrl}/api/health`);
    assert.equal(r2.status, 200);
    const j2 = await r2.json();
    assert.equal(j2.success, true);

    const r404 = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(r404.status, 404);
  } finally {
    server.close();
  }
});

test('Protected endpoints reject requests without Bearer token', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    for (const path of ['/api/auth/me', '/api/devices', '/api/alerts', '/api/falls/history']) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 401, `${path} should require auth`);
    }
  } finally {
    server.close();
  }
});

test('Validation rejects malformed register / nearby / pair inputs before DB', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const badReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'not-an-email', password: '123' }),
    });
    assert.equal(badReg.status, 400);

    const badCoords = await fetch(`${baseUrl}/api/nearby/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 999, longitude: 77.2, fcmToken: 'tok' }),
    });
    assert.equal(badCoords.status, 400);

    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
    const badPair = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pairingCode: 'abc' }),
    });
    assert.equal(badPair.status, 400);
  } finally {
    server.close();
  }
});

test('pairDevice rejects unknown/unissued pairing codes (does not allow fake codes)', async () => {
  const origFindOneAndUpdate = PairCode.findOneAndUpdate;
  PairCode.findOneAndUpdate = async () => null;

  const { server, baseUrl } = await startTestServer();
  try {
    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
    const res = await fetch(`${baseUrl}/api/devices/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pairingCode: '999999', deviceName: 'Fake Phone' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /invalid|expired/i);
  } finally {
    PairCode.findOneAndUpdate = origFindOneAndUpdate;
    server.close();
  }
});

test('calculateDistanceMeters computes accurate Haversine distance', () => {
  const same = calculateDistanceMeters(28.6139, 77.209, 28.6139, 77.209);
  assert.equal(same, 0);

  // ~111m per 0.001 degree latitude
  const approx111m = calculateDistanceMeters(28.6139, 77.209, 28.6149, 77.209);
  assert.ok(approx111m >= 105 && approx111m <= 115, `Expected ~111m, got ${approx111m}`);
});

test('Model mocks sanity: User and Device models exist', () => {
  assert.ok(User);
  assert.ok(Device);
});

test('Fall helpers sanitize 5-stage sensorData and derive severity', () => {
  assert.equal(deriveFallSeverity(4.8), 'Critical');
  assert.equal(deriveFallSeverity(3.6), 'High');
  assert.equal(deriveFallSeverity(2.7), 'Medium');
  assert.equal(deriveFallSeverity(2.0), 'Low');

  const clean = sanitizeSensorData({
    accelerometer: { x: 3, y: 4, z: 0 },
    gyroscope: { x: 1, y: 2, z: 2 },
    freeFallDurationMs: 140.4,
    peakImpactG: 3.845,
    stagesCompleted: ['normal', 'free_fall', 'impact', 'confirmation', 'alert'],
  });

  assert.equal(clean.accelerometer.magnitude, 5);
  assert.equal(clean.gyroscope.magnitude, 3);
  assert.equal(clean.freeFallDurationMs, 140);
  assert.equal(clean.peakImpactG, 3.85);
  assert.deepEqual(clean.stagesCompleted, ['normal', 'free_fall', 'impact', 'confirmation', 'alert']);
});

test('POST /api/falls/report validates malformed payload before DB', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
    const res = await fetch(`${baseUrl}/api/falls/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ severity: 'InvalidLevel', confidence: 5 }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
