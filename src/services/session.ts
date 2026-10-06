/** Credentials remain separate from planner storage and backups. */
import { api, ApiError } from './api';
import { readCredential, writeCredential, removeCredential } from './credentials';
export interface AccountSession {
  token: string;
  expiresAt: string;
  user: { id: string; email: string };
}
export async function readSession(): Promise<AccountSession | null> {
  const raw = await readCredential();
  if (!raw) return null;
  let session: AccountSession;
  try {
    session = JSON.parse(raw) as AccountSession;
  } catch {
    await removeCredential();
    return null;
  }
  if (
    !session?.token ||
    !session.user?.id ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    Date.parse(session.expiresAt) <= Date.now()
  ) {
    await removeCredential();
    return null;
  }
  try {
    await api('/auth/me', session.token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await removeCredential();
      return null;
    }
    if (!(error instanceof ApiError) || error.status !== 0) throw error;
    // A previously authenticated, unexpired session may use its local planner offline.
  }
  return session;
}
export async function signIn(
  email: string,
  password: string,
  register: boolean,
): Promise<AccountSession> {
  const session = await api<AccountSession>(
    register ? '/auth/register' : '/auth/login',
    undefined,
    { email: email.trim(), password },
  );
  await writeCredential(JSON.stringify(session));
  return session;
}
export async function signOut(session: AccountSession): Promise<void> {
  try {
    await api('/auth/logout', session.token, {}, 'POST');
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  await removeCredential();
}
export async function changePassword(
  session: AccountSession,
  current: string,
  next: string,
): Promise<AccountSession> {
  const result = await api<AccountSession>('/auth/password', session.token, {
    current_password: current,
    new_password: next,
  });
  await writeCredential(JSON.stringify(result));
  return result;
}
