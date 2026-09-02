export {
  createClientSignalingMessage,
  isClientSignalingMessage,
  isServerSignalingMessage,
  MAX_SIGNALING_MESSAGE_BYTES,
  SIGNALING_PROTOCOL_VERSION,
  SIGNALING_SUBPROTOCOL,
  type ClientSignalingMessage,
  type ServerSignalingMessage,
} from '../../shared/signaling-protocol';

import { SIGNALING_SUBPROTOCOL } from '../../shared/signaling-protocol';

const MAX_FIREBASE_TOKEN_LENGTH = 10_000;

export function getFirebaseTokenFromSubprotocolHeader(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const protocols = header
    .split(',')
    .map((protocol) => protocol.trim())
    .filter(Boolean);

  if (protocols.length !== 2 || protocols[0] !== SIGNALING_SUBPROTOCOL) {
    return null;
  }

  const token = protocols[1];
  return token.length > 0 && token.length <= MAX_FIREBASE_TOKEN_LENGTH ? token : null;
}
