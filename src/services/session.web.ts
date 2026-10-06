/** Browser credentials are HttpOnly cookies: never exposed to JavaScript storage. */
import { api, ApiError } from './api';
import type { AccountSession } from './session';
export type { AccountSession } from './session';

export async function readSession(): Promise<AccountSession | null> {
  try {
    const session = await api<AccountSession>('/auth/session');
    return { ...session, token: session.user.id }; // Public identity guard, never a credential.
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
export async function signIn(email: string, password: string, register: boolean) {
  await api(register ? '/auth/register' : '/auth/login', undefined, {
    email: email.trim(),
    password,
  });
  // Verify the browser accepted the cookie before opening an account's planner.
  const session = await readSession();
  if (!session)
    throw new Error(
      'Your browser blocked the sign-in cookie. Use the same hostname for Planly and its API.',
    );
  return session;
}
export async function signOut(session: AccountSession) {
  try {
    await api('/auth/logout', session.user.id, {}, 'POST');
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
}
export async function changePassword(session: AccountSession, current: string, next: string) {
  const result = await api<AccountSession>('/auth/password', session.user.id, {
    current_password: current,
    new_password: next,
  });
  return { ...result, token: result.user.id };
}
