import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, googleAuthProvider, syncUserProfile } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await syncUserProfile({
            uid: nextUser.uid,
            displayName: nextUser.displayName,
            email: nextUser.email,
            photoURL: nextUser.photoURL,
          });
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-out failed.';
      setAuthError(msg);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, authReady, authError, signInWithGoogle, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
