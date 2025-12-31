import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables before Firebase initialization
// Try multiple possible locations for .env.local
const envPaths = [
  path.resolve(process.cwd(), "../.env.local"),  // When running from backend/
  path.resolve(process.cwd(), ".env.local"),      // When running from root
  path.resolve(__dirname, "../../../.env.local"), // Relative to compiled location
  path.resolve(__dirname, "../../.env.local"),    // Alternative relative path
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`[Firebase] Loaded env from: ${envPath}`);
    break;
  }
}

// Also try loading from backend's own .env if it exists
dotenv.config();

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccount) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. " +
      "Please add your Firebase service account JSON to your .env.local file."
    );
  }

  try {
    const credentials = JSON.parse(serviceAccount);
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
  } catch (error) {
    throw new Error(
      "Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY. " +
      "Make sure it contains valid JSON from your Firebase service account."
    );
  }
}

export const db = admin.firestore();

export const COLLECTIONS = {
  ORGANIZATIONS: "organizations",
  GROUP_AUTOMATION: "groupAutomation",
  AUDIT_LOGS: "auditLogs",
  PENDING_BOT_JOINS: "pendingBotJoins",
  GROUP_ACCESS: "groupAccess",
  SITE_CONFIG: "siteConfig",
} as const;

// Site admin interface
export interface SiteAdmin {
  robloxId: string;
}

// Get all site admins
export async function getSiteAdmins(): Promise<SiteAdmin[]> {
  try {
    const configDoc = await db.collection(COLLECTIONS.SITE_CONFIG).doc("admins").get();
    
    if (!configDoc.exists) {
      const defaultAdmins: SiteAdmin[] = [{
        robloxId: "3857050833",
      }];
      await db.collection(COLLECTIONS.SITE_CONFIG).doc("admins").set({ admins: defaultAdmins });
      return defaultAdmins;
    }

    const data = configDoc.data();
    return data?.admins || [];
  } catch (error) {
    console.error("Error fetching site admins:", error);
    return [{ robloxId: "3857050833" }];
  }
}

// Check if a user is a site admin
export async function isSiteAdmin(robloxId: string): Promise<boolean> {
  const admins = await getSiteAdmins();
  return admins.some(admin => admin.robloxId === robloxId);
}

// Helper to get a document
export async function getDocument<T>(
  collection: string,
  docId: string,
  defaultValue: T
): Promise<T> {
  const docRef = db.collection(collection).doc(docId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return defaultValue;
  }
  return doc.data() as T;
}

// Helper to set a document
export async function setDocument<T extends admin.firestore.DocumentData>(
  collection: string,
  docId: string,
  data: T
): Promise<void> {
  const docRef = db.collection(collection).doc(docId);
  await docRef.set(data);
}
