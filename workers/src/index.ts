import { CallSession } from './call-session';
import { verifyFirebaseIdToken } from './firebase-token';
import { getFirebaseTokenFromSubprotocolHeader, SIGNALING_SUBPROTOCOL } from './protocol';
import { UserSession } from './user-session';
import { fetchMeteredIceServers } from './turn-credentials';

export { CallSession, UserSession };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ service: 'callnet-signaling', status: 'ok' });
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
          reason: error instanceof Error ? error.message : 'unknown',
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
