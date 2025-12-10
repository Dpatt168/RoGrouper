import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
  type WhereFilterOp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Use service account credentials from environment variable
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccount) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. " +
      "Please add your Firebase service account JSON to your .env.local file."
    );
  }

  try {
    const credentials = JSON.parse(serviceAccount);
    return initializeApp({
      credential: cert(credentials),
    });
  } catch (error) {
    throw new Error(
      "Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. " +
      "Make sure it contains valid JSON from your Firebase service account."
    );
  }
}

// Get Firestore instance
export function getDb(): Firestore {
  const app = getFirebaseApp();
  return getFirestore(app);
}

// Collection names
export const COLLECTIONS = {
  ORGANIZATIONS: "organizations",
  AWARDS: "awards",
  GROUP_AUTOMATION: "groupAutomation",
  AUDIT_LOGS: "auditLogs",
  PENDING_BOT_JOINS: "pendingBotJoins",
} as const;

// Helper to get a document reference with type safety
export async function getDocument<T>(
  collection: string,
  docId: string,
  defaultValue: T
): Promise<T> {
  const db = getDb();
  const docRef = db.collection(collection).doc(docId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return defaultValue;
  }
  
  return doc.data() as T;
}

// Helper to set a document
export async function setDocument<T extends object>(
  collection: string,
  docId: string,
  data: T
): Promise<void> {
  const db = getDb();
  const docRef = db.collection(collection).doc(docId);
  await docRef.set(data, { merge: true });
}

// Helper to delete a document
export async function deleteDocument(
  collection: string,
  docId: string
): Promise<void> {
  const db = getDb();
  const docRef = db.collection(collection).doc(docId);
  await docRef.delete();
}

// Helper to query documents
export async function queryDocuments<T>(
  collection: string,
  field: string,
  operator: WhereFilterOp,
  value: unknown
): Promise<T[]> {
  const db = getDb();
  const snapshot = await db
    .collection(collection)
    .where(field, operator, value)
    .get();
  
  return snapshot.docs.map(
    (doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as T)
  );
}

// Helper to get all documents in a collection
export async function getAllDocuments<T>(collection: string): Promise<T[]> {
  const db = getDb();
  const snapshot = await db.collection(collection).get();
  return snapshot.docs.map(
    (doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as T)
  );
}
