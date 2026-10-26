// This function is deployed only with the matching permit migration. Secrets
// remain in the self-hosted Edge Functions environment, never in Expo.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

type Dependencies = {
  env: (name: string) => string | undefined;
  fetcher: typeof fetch;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION = 'zacapp_reporte_envio';

export async function handleGuestReportVerification(request: Request, dependencies: Dependencies): Promise<Response> {
  const allowedOrigins = new Set((dependencies.env('ZACAPP_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  const allowedHostnames = new Set((dependencies.env('TURNSTILE_ALLOWED_HOSTNAMES') ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (origin && allowedOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-allow-headers'] = 'authorization, apikey, content-type, x-client-info';
    headers.vary = 'Origin';
  }
  const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? { error } : { ok: true }), { status, headers });

  if (origin && !allowedOrigins.has(origin)) return reply(403, 'Origin not allowed');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'Method not allowed');

  const baseUrl = dependencies.env('SUPABASE_URL')?.replace(/\/$/, '');
  const anonKey = dependencies.env('SUPABASE_ANON_KEY');
  const serviceKey = dependencies.env('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecret = dependencies.env('TURNSTILE_SECRET_KEY');
  if (!baseUrl || !anonKey || !serviceKey || !turnstileSecret || !allowedHostnames.size) return reply(503, 'Verification unavailable');

  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [^\s]{20,8192}$/.test(authorization)) return reply(401, 'Authenticated guest required');

  let payload: { incidentId?: unknown; turnstileToken?: unknown };
  try { payload = await request.json() as typeof payload; }
  catch { return reply(400, 'Invalid request'); }
  if (typeof payload?.incidentId !== 'string' || !UUID.test(payload.incidentId)
    || typeof payload.turnstileToken !== 'string' || !payload.turnstileToken || payload.turnstileToken.length > 2048) {
    return reply(400, 'Invalid request');
  }

  try {
    const identityResponse = await dependencies.fetcher(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization }
    });
    if (!identityResponse.ok) return reply(401, 'Authenticated guest required');
    const identity = await identityResponse.json() as { id?: string; is_anonymous?: boolean };
    if (!identity.id || !UUID.test(identity.id) || identity.is_anonymous !== true) return reply(403, 'Anonymous account required');

    const challengeResponse = await dependencies.fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: payload.turnstileToken })
    });
    if (!challengeResponse.ok) return reply(502, 'Verification unavailable');
    const challenge = await challengeResponse.json() as { success?: boolean; action?: string; hostname?: string };
    if (challenge.success !== true || challenge.action !== ACTION || !allowedHostnames.has(challenge.hostname?.toLowerCase() ?? '')) {
      return reply(403, 'Fresh challenge required');
    }

    const permitResponse = await dependencies.fetcher(`${baseUrl}/rest/v1/rpc/issue_guest_report_permit`, {
      method: 'POST',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_account_id: identity.id, p_incident_id: payload.incidentId })
    });
    if (!permitResponse.ok) return reply(502, 'Verification unavailable');
    return reply(200);
  } catch {
    return reply(502, 'Verification unavailable');
  }
}

if (typeof Deno !== 'undefined') {
  Deno.serve((request) => handleGuestReportVerification(request, {
    env: (name) => Deno.env.get(name),
    fetcher: fetch
  }));
}
