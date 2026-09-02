import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  authService,
  type AuthService,
  type AuthUser,
} from './auth-service';

type AuthContextValue = {
  status: 'loading' | 'ready';
  user: AuthUser | null;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  createEmailAccount(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{ service?: AuthService }>;

export function AuthProvider({ children, service = authService }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(() => service.getCurrentUser());

  useEffect(() => {
    return service.subscribe((nextUser) => {
      setUser(nextUser);
      setStatus('ready');
    });
  }, [service]);

  const signInWithGoogle = useCallback(async () => {
    setUser(await service.signInWithGoogle());
  }, [service]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setUser(await service.signInWithEmail(email, password));
  }, [service]);

  const createEmailAccount = useCallback(async (email: string, password: string, displayName: string) => {
    setUser(await service.createEmailAccount(email, password, displayName));
  }, [service]);

  const signOut = useCallback(async () => {
    await service.signOut();
  }, [service]);

  const getIdToken = useCallback((forceRefresh = false) => service.getIdToken(forceRefresh), [service]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    signInWithGoogle,
    signInWithEmail,
    createEmailAccount,
    signOut,
    getIdToken,
  }), [status, user, signInWithGoogle, signInWithEmail, createEmailAccount, signOut, getIdToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
