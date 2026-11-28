import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDocFromServer,
  serverTimestamp,
  collection,
  setDoc,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import rawFirebaseConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || rawFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || rawFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || rawFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || rawFirebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || rawFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || rawFirebaseConfig.measurementId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    rawFirebaseConfig.firestoreDatabaseId ||
    '(default)',
};

export const app = initializeApp(firebaseConfig);

try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported
}

function initDb() {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache(),
      },
      dbId
    );
  } catch {
    try {
      return initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          localCache: memoryLocalCache(),
        },
        dbId
      );
    } catch {
      return getFirestore(app, dbId);
    }
  }
}

export const db = initDb();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAP_ADMIN_EMAIL = 'merlinfiverr0@gmail.com';
export const BOOTSTRAP_ADMIN_EMAILS = [
  'merlinfiverr0@gmail.com',
  'onelovecafesigiriya@gmail.com',
  'manojmadurangasadaruwan@gmail.com',
];

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAP_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized);
}

export function getPrimaryUserEmail(
  user?: { email?: string | null; providerData?: Array<{ email?: string | null } | null> } | null
): string {
  if (!user) return '';
  if (user.email && user.email.trim()) return user.email.trim().toLowerCase();
  const providerEmail = user.providerData?.find((p) => p?.email && p.email.trim())?.email;
  return providerEmail ? providerEmail.trim().toLowerCase() : '';
}

export function isAuthorizedAdminUser(
  user?: { email?: string | null; providerData?: Array<{ email?: string | null } | null> } | null
): boolean {
  if (!user) return false;
  if (isAuthorizedAdminEmail(user.email)) return true;
  if (Array.isArray(user.providerData)) {
    return user.providerData.some((provider) => isAuthorizedAdminEmail(provider?.email));
  }
  return false;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot as required by firebase-integration-rpc
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Record admin audit log entries in Firestore
export async function logAdminAction(
  action: string,
  targetCollection: string,
  targetId: string,
  summary: string
) {
  const user = auth.currentUser;
  const email = getPrimaryUserEmail(user);
  if (!user || !email) return;
  const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(collection(db, 'auditLogs'), logId), {
      actorEmail: email.slice(0, 120),
      actorUid: user.uid.slice(0, 80),
      action: action.slice(0, 80),
      targetCollection: targetCollection.slice(0, 60),
      targetId: targetId.slice(0, 80),
      summary: summary.slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if audit log write is skipped
  }
}
