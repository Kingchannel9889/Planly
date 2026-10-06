import { requestOptions } from './request-options';
import { LOCAL_ONLY } from '@/core/app-mode';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export async function api<T>(
  path: string,
  token?: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  if (LOCAL_ONLY) throw new ApiError(0, 'This edition stores your planner on this device only.');
  if (!API_URL) throw new ApiError(0, 'Set EXPO_PUBLIC_API_URL to connect Planly to your server.');
  if (!__DEV__ && !API_URL.startsWith('https://'))
    throw new ApiError(0, 'A secure HTTPS server is required.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      method,
      signal: controller.signal,
      headers: {
        ...requestOptions.headers,
        'Content-Type': 'application/json',
        ...(token
          ? requestOptions.credentials === 'include'
            ? { 'X-Planly-Account': token }
            : { Authorization: `Bearer ${token}` }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 204) return undefined as T;
    const result = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof result.detail === 'string'
          ? result.detail
          : 'The server could not process this request.',
      );
    return result as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Cannot reach the Planly server. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}
