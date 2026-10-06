/** Account-isolated local persistence, with revision-checked server synchronization. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { emptyData, type Entry, type PlannerData } from '@/core/model';
import { accountReminders, startAccountReminders } from '@/services/account-reminders';
import {
  exchangePlanner,
  persistPlanner,
  readPlanner,
  type PlannerCache,
} from '@/services/planner-sync';
import { ApiError } from '@/services/api';
import { useSession } from './session-store';
import { LOCAL_ONLY, LOCAL_PLANNER_ID } from '@/core/app-mode';
interface Store {
  data: PlannerData;
  ready: boolean;
  now: Date;
  error: string;
  notificationError: string;
  syncStatus: string;
  syncIssue: boolean;
  conflict: boolean;
  sync: (choice?: 'device' | 'server') => Promise<void>;
  change: (
    update: (data: PlannerData) => PlannerData,
    resetNotifications?: boolean,
  ) => Promise<void>;
  save: (entry: Entry) => Promise<void>;
  remove: (id: string) => Promise<void>;
  retry: () => void;
}
const Context = createContext<Store | null>(null);
export function PlannerProvider({ children }: { children: ReactNode }) {
  const { account } = useSession();
  return (
    <AccountPlanner key={LOCAL_ONLY ? LOCAL_PLANNER_ID : (account?.user.id ?? 'signed-out')}>
      {children}
    </AccountPlanner>
  );
}
function AccountPlanner({ children }: { children: ReactNode }) {
  const { account, expire } = useSession();
  const identity = useRef(account);
  const ownerId = useRef(LOCAL_ONLY ? LOCAL_PLANNER_ID : account?.user.id);
  useEffect(() => {
    identity.current = account;
    ownerId.current = LOCAL_ONLY ? LOCAL_PLANNER_ID : account?.user.id;
  }, [account]);
  const [data, setData] = useState(emptyData),
    [ready, setReady] = useState(!LOCAL_ONLY && !account);
  const [now, setNow] = useState(new Date()),
    [error, setError] = useState('');
  const [notificationError, setNotificationError] = useState(''),
    [syncStatus, setSyncStatus] = useState('');
  const [conflict, setConflict] = useState(false);
  const [syncIssue, setSyncIssue] = useState(false);
  const current = useRef<PlannerCache>({ data, revision: 0, dirty: false });
  const queue = useRef<Promise<unknown>>(Promise.resolve()),
    loaded = useRef(false),
    alive = useRef(true);
  const commit = useCallback(async (value: PlannerCache) => {
    const owner = ownerId.current;
    if (!owner) throw new Error('Please sign in.');
    await persistPlanner(owner, value);
    current.current = value;
    if (alive.current) setData(value.data);
  }, []);
  const reminders = useCallback(
    async (reset = false) => {
      const owner = ownerId.current;
      if (!owner || !alive.current) return;
      try {
        const result = await accountReminders(owner, current.current.data, reset);
        if (JSON.stringify(result) !== JSON.stringify(current.current.data))
          await commit({ ...current.current, data: result, dirty: true });
        if (alive.current) setNotificationError('');
      } catch {
        if (alive.current)
          setNotificationError(
            'Reminders could not be refreshed. Your tasks are saved. Retry in Settings.',
          );
      }
    },
    [commit],
  );
  const synchronize = useCallback(
    async (choice?: 'device' | 'server') => {
      if (LOCAL_ONLY) {
        setSyncStatus('Saved on this device');
        return true;
      }
      const owner = identity.current;
      if (!owner || !alive.current) return;
      setSyncStatus('Syncing...');
      try {
        const result = await exchangePlanner(owner, current.current, choice);
        await commit(result);
        if (!alive.current) return;
        setConflict(false);
        setSyncIssue(false);
        setSyncStatus('Saved to your account');
        await reminders(choice === 'server');
        return true;
      } catch (e) {
        if (!alive.current) return;
        if (e instanceof ApiError && e.status === 401) {
          await expire();
          return false;
        }
        setConflict(e instanceof ApiError && e.status === 409);
        setSyncIssue(true);
        setSyncStatus(
          e instanceof Error
            ? `${e.message} Your local copy is safe.`
            : 'Sync failed. Your local copy is safe.',
        );
        if (choice) throw e;
        return false;
      }
    },
    [commit, reminders, expire],
  );
  const load = useCallback(() => {
    const owner = ownerId.current;
    if (!owner) return;
    void readPlanner(owner)
      .then(async (value) => {
        if (!alive.current) return;
        current.current = value;
        setData(value.data);
        setError('');
        // Fetch existing account data before deciding whether onboarding is needed.
        queue.current = queue.current.then(async () => {
          const synced = await synchronize();
          if (!alive.current) return;
          if (!synced && !value.cached) {
            setError(
              'Connect to the server to download your planner for the first time. Retry loading.',
            );
            return;
          }
          startAccountReminders(owner);
          loaded.current = true;
          await reminders();
          if (alive.current) setReady(true);
        });
      })
      .catch(() =>
        setError(
          'Your saved planner could not be opened. Nothing has been overwritten. Retry loading.',
        ),
      );
  }, [synchronize, reminders]);
  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      if (loaded.current && alive.current)
        queue.current = queue.current
          .then(async () => {
            await reminders();
            await synchronize();
          })
          .catch(() => {});
    };
    const timer = setInterval(tick, 60000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [reminders, synchronize]);
  const change = useCallback(
    (update: (value: PlannerData) => PlannerData, reset = false) => {
      const operation = queue.current.then(async () => {
        if (!loaded.current || !alive.current) throw new Error('Planner is still loading.');
        await commit({ ...current.current, data: update(current.current.data), dirty: true });
        setSyncStatus(
          LOCAL_ONLY
            ? 'Saved on this device'
            : 'Saved on this device. Waiting to sync to your account.',
        );
        setNow(new Date());
        await reminders(reset);
      });
      queue.current = operation.then(() => synchronize()).catch(() => {});
      return operation;
    },
    [commit, reminders, synchronize],
  );
  const save = useCallback(
    (entry: Entry) =>
      change((value) => {
        const old = value.entries.find((e) => e.id === entry.id);
        const next = {
          ...entry,
          riskHistory: old && old.deadline === entry.deadline ? old.riskHistory : {},
        };
        return {
          ...value,
          entries: [
            ...value.entries
              .filter((e) => e.id !== next.id)
              .map((e) => (next.inProgress ? { ...e, inProgress: false } : e)),
            next,
          ],
        };
      }),
    [change],
  );
  const sync = (choice?: 'device' | 'server') => {
    const operation = queue.current.then(async () => {
      await synchronize(choice);
    });
    queue.current = operation.catch(() => {});
    return operation;
  };
  return (
    <Context.Provider
      value={{
        data,
        ready,
        now,
        error,
        notificationError,
        syncStatus,
        syncIssue,
        conflict,
        sync,
        change,
        save,
        remove: (id) =>
          change((value) => ({ ...value, entries: value.entries.filter((e) => e.id !== id) })),
        retry: () => {
          if (loaded.current) void sync();
          else load();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePlanner(): Store {
  const value = useContext(Context);
  if (!value) throw new Error('PlannerProvider missing.');
  return value;
}
