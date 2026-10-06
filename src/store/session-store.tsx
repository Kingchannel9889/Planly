import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  readSession,
  signIn,
  signOut,
  changePassword,
  type AccountSession,
} from '@/services/session';
import { stopAccountReminders, startAccountReminders } from '@/services/account-reminders';
import { removeCredential } from '@/services/credentials';
import { LOCAL_ONLY } from '@/core/app-mode';
interface Session {
  active: boolean;
  ready: boolean;
  error: string;
  account: AccountSession | null;
  retry: () => void;
  expire: () => Promise<void>;
  login: (email: string, password: string, register: boolean) => Promise<void>;
  logout: () => Promise<void>;
  password: (current: string, next: string) => Promise<void>;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [ready, setReady] = useState(LOCAL_ONLY),
    [error, setError] = useState('');
  const retry = useCallback(() => {
    if (LOCAL_ONLY) return;
    void readSession()
      .then(async (value) => {
        if (!value) await stopAccountReminders();
        setAccount(value);
        setReady(true);
        setError('');
      })
      .catch(() =>
        setError('Could not open your account session. Your planner is unchanged. Retry loading.'),
      );
  }, []);
  useEffect(retry, [retry]);
  const expire = useCallback(async () => {
    if (LOCAL_ONLY) return;
    await stopAccountReminders();
    await removeCredential();
    setAccount(null);
  }, []);
  useEffect(() => {
    if (!account) return;
    const timer = setTimeout(
      () => {
        void expire().catch(() => setError('Could not close the expired session. Restart Planly.'));
      },
      Math.max(0, Date.parse(account.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [account, expire]);
  return (
    <Context.Provider
      value={{
        active: LOCAL_ONLY || !!account,
        ready,
        error,
        account,
        retry,
        expire,
        login: async (email, password, register) => {
          if (LOCAL_ONLY) return;
          setAccount(await signIn(email, password, register));
        },
        logout: async () => {
          if (!account) return;
          try {
            await stopAccountReminders();
            await signOut(account);
            setAccount(null);
          } catch (error) {
            startAccountReminders(account.user.id);
            throw error;
          }
        },
        password: async (current, next) => {
          if (account) setAccount(await changePassword(account, current, next));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error('SessionProvider missing.');
  return context;
}
