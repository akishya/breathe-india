import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { CreationKind, GameScore, SavedCreation, SavedPlace } from '../types/studio';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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

// Validate Firestore connection on module boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function createSafeDocId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

export async function syncUserProfile(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}) {
  if (!user.email) return;
  const path = `users/${user.uid}`;
  try {
    const payload: Record<string, unknown> = {
      uid: user.uid,
      displayName: (user.displayName || user.email.split('@')[0] || 'Studio User').slice(0, 120),
      email: user.email.slice(0, 254),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL && user.photoURL.length <= 500) {
      payload.photoURL = user.photoURL;
    }
    await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveCreation(input: {
  ownerId: string;
  kind: CreationKind;
  title: string;
  content: string;
  modelUsed: string;
}): Promise<string> {
  const id = createSafeDocId('cr');
  const path = `creations/${id}`;
  try {
    await setDoc(doc(db, 'creations', id), {
      id,
      ownerId: input.ownerId,
      kind: input.kind,
      title: input.title.trim().slice(0, 160) || 'Untitled Entry',
      content: input.content.trim().slice(0, 8000) || '(Empty)',
      modelUsed: input.modelUsed.trim().slice(0, 80) || 'gemini-4-hydrogen',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCreation(id: string): Promise<void> {
  const path = `creations/${id}`;
  try {
    await deleteDoc(doc(db, 'creations', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeUserCreations(
  uid: string,
  onData: (items: SavedCreation[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'creations'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => d.data() as SavedCreation);
      rows.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        return tb - ta;
      });
      onData(rows);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, 'creations');
    }
  );
}

export async function savePinnedPlace(input: {
  ownerId: string;
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  note?: string;
}): Promise<string> {
  const id = createSafeDocId('pl');
  const path = `places/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      ownerId: input.ownerId,
      placeId: input.placeId.slice(0, 200),
      name: input.name.trim().slice(0, 160) || 'Pinned Location',
      address: input.address.trim().slice(0, 300) || 'Selected coordinates',
      lat: Math.max(-90, Math.min(90, input.lat)),
      lng: Math.max(-180, Math.min(180, input.lng)),
      createdAt: serverTimestamp(),
    };
    if (input.note && input.note.trim()) {
      payload.note = input.note.trim().slice(0, 500);
    }
    await setDoc(doc(db, 'places', id), payload);
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deletePinnedPlace(id: string): Promise<void> {
  const path = `places/${id}`;
  try {
    await deleteDoc(doc(db, 'places', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeUserPlaces(
  uid: string,
  onData: (items: SavedPlace[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'places'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => d.data() as SavedPlace);
      rows.sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
        return tb - ta;
      });
      onData(rows);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, 'places');
    }
  );
}

export async function saveGameScore(input: {
  ownerId: string;
  playerName: string;
  score: number;
  wave: number;
}): Promise<string> {
  const id = createSafeDocId('sc');
  const path = `gameScores/${id}`;
  try {
    await setDoc(doc(db, 'gameScores', id), {
      id,
      ownerId: input.ownerId,
      playerName: input.playerName.trim().slice(0, 80) || 'Pilot',
      score: Math.max(0, Math.min(10000000, Math.floor(input.score))),
      wave: Math.max(1, Math.min(1000, Math.floor(input.wave))),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeUserScores(
  uid: string,
  onData: (items: GameScore[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'gameScores'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => d.data() as GameScore);
      rows.sort((a, b) => b.score - a.score);
      onData(rows);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, 'gameScores');
    }
  );
}
