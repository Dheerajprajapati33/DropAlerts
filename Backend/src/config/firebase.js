import admin from "firebase-admin";
let messaging = null;
try {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    messaging = admin.messaging();
    console.log("Firebase enabled");
  } else console.warn("Firebase credentials missing: push delivery disabled");
} catch (e) {
  console.error("Firebase initialization failed:", e.message);
}
export { messaging };
