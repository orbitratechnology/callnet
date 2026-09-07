import { CallSession } from './call-session';
import { verifyFirebaseIdToken } from './firebase-token';
import { getFirebaseTokenFromSubprotocolHeader, SIGNALING_SUBPROTOCOL } from './protocol';
import { UserSession } from './user-session';
import { fetchMeteredIceServers } from './turn-credentials';
import { redactDiagnostic } from '../../shared/diagnostics';
import { matchDirectoryContacts, type DirectoryContactInput } from './directory';

export { CallSession, UserSession };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json(
        { service: 'callnet-signaling', status: 'ok' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (request.method === 'GET' && url.pathname === '/calls/active') {
      const authorization = request.headers.get('Authorization');
      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';
      if (!token) {
        return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      let uid: string;
      try {
        uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
      } catch {
        return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      try {
        const calls = await env.USER_SESSION.getByName(uid).getActiveCallSnapshots();
        return Response.json(
          { calls },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      } catch (error) {
        console.warn(JSON.stringify({ event: 'active_calls_request_failed', reason: redactDiagnostic(error, 96) }));
        return new Response('Unable to read active calls.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/ice-servers') {
      const authorization = request.headers.get('Authorization');
      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';
      if (!token) {
        return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      try {
        await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
      } catch {
        return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      try {
        const iceServers = await fetchMeteredIceServers(env);
        return Response.json(iceServers, {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: 'ice_servers_request_failed',
            reason: 'turn-provider-unavailable',
          }),
        );
        return new Response('Unable to provide ICE servers.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/contacts/match') {
      const authorization = request.headers.get('Authorization');
      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';
      if (!token) {
        return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      let uid: string;
      try {
        uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
      } catch {
        return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }

      try {
        const bodyText = await request.text();
        if (new TextEncoder().encode(bodyText).byteLength > 256 * 1024) {
          return new Response('Request is too large.', { status: 413, headers: { 'Cache-Control': 'no-store' } });
        }
        const parsedBody: unknown = JSON.parse(bodyText);
        if (!parsedBody || typeof parsedBody !== 'object') {
          return new Response('Invalid contacts request.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
        }
        const rawContacts = (parsedBody as { contacts?: unknown }).contacts;
        if (!Array.isArray(rawContacts)) {
          return new Response('Invalid contacts request.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
        }
        const contacts: DirectoryContactInput[] = rawContacts.flatMap((contact) => {
              if (!contact || typeof contact !== 'object') return [];
              const contactId = (contact as { contactId?: unknown }).contactId;
              const tokens = (contact as { tokens?: unknown }).tokens;
              if (typeof contactId !== 'string' || !Array.isArray(tokens)) return [];
              return [{
                contactId,
                tokens: tokens.filter((token): token is string => typeof token === 'string'),
              }];
            });
        const matches = await matchDirectoryContacts(env, contacts, uid);
        return Response.json({ matches }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.warn(JSON.stringify({ event: 'contact_match_failed', reason: redactDiagnostic(error, 96) }));
        return new Response('Contacts are unavailable.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    if (url.pathname !== '/ws') {
      return new Response('Not found.', { status: 404 });
    }

    if (
      request.method !== 'GET' ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    ) {
      return new Response('WebSocket upgrade required.', { status: 426 });
    }

    const token = getFirebaseTokenFromSubprotocolHeader(
      request.headers.get('Sec-WebSocket-Protocol'),
    );
    if (!token) {
      return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    let uid: string;
    try {
      uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: 'firebase_token_rejected',
          reason: redactDiagnostic(error, 96) || 'unknown',
        }),
      );
      return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const headers = new Headers(request.headers);
    headers.set('X-Callnet-User-Id', uid);
    headers.set('X-Callnet-Subprotocol', SIGNALING_SUBPROTOCOL);

    return env.USER_SESSION.getByName(uid).fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Env>;
