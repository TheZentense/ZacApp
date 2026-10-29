import type { SupabaseClient } from '@supabase/supabase-js';

type AuthCallback = {
  accessToken?: string;
  code?: string;
  error?: string;
  refreshToken?: string;
  type?: string;
};

function decode(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseSection(section: string) {
  const values = new Map<string, string>();
  for (const pair of section.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = decode(separator >= 0 ? pair.slice(0, separator) : pair);
    const value = decode(separator >= 0 ? pair.slice(separator + 1) : '');
    if (key) values.set(key, value);
  }
  return values;
}

export function parseAuthCallback(url: string): AuthCallback | null {
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const queryEnd = hashStart >= 0 ? hashStart : url.length;
  const query = queryStart >= 0 ? parseSection(url.slice(queryStart + 1, queryEnd)) : new Map<string, string>();
  const hash = hashStart >= 0 ? parseSection(url.slice(hashStart + 1)) : new Map<string, string>();
  const value = (key: string) => hash.get(key) || query.get(key) || undefined;
  const callback = {
    accessToken: value('access_token'),
    code: value('code'),
    error: value('error_description') || value('error'),
    refreshToken: value('refresh_token'),
    type: value('type')
  };
  return callback.code || (callback.accessToken && callback.refreshToken) || callback.error ? callback : null;
}

export async function consumeAuthDeepLink(client: SupabaseClient, url: string) {
  const callback = parseAuthCallback(url);
  if (!callback) return { handled: false, type: undefined };
  if (callback.error) throw new Error(callback.error);
  if (callback.code) {
    const { error } = await client.auth.exchangeCodeForSession(callback.code);
    if (error) throw error;
  } else if (callback.accessToken && callback.refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken
    });
    if (error) throw error;
  }
  return { handled: true, type: callback.type };
}
