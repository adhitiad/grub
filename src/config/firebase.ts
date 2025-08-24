import admin from "firebase-admin";
import { config } from "./env";

const serviceAccount = {
  projectId: config.firebase.projectId,
  privateKey: config.firebase.privateKey,
  clientEmail: config.firebase.clientEmail,
};

// Initialize Firebase Admin SDK only if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
