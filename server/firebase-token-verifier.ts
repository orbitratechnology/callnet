type FirebaseCertificateResponse = {
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<Record<string, string>>;
};

type VerifyLike = {
  update(value: string): void;
  end(): void;
  verify(certificate: string, signature: Uint8Array): boolean;
};

type CryptoLike = {
  createVerify(algorithm: string): VerifyLike;
};

declare const require: (moduleName: string) => unknown;
declare const fetch: (input: string) => Promise<FirebaseCertificateResponse>;
type BufferLike = Uint8Array & { toString(encoding?: string): string };

declare const Buffer: {
  from(input: string, encoding: string): BufferLike;
};

const { createVerify } = require('node:crypto') as CryptoLike;
const certificatesUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificates: Map<string, string> | null = null;
let certificatesExpireAt = 0;

function decodeSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function getCertificates() {
  if (certificates && Date.now() < certificatesExpireAt) {
    return certificates;
  }

  const response = await fetch(certificatesUrl);
  if (!response.ok) {
    throw new Error('Unable to load Firebase token certificates.');
  }

  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;
  certificates = new Map(Object.entries(await response.json()));
  certificatesExpireAt = Date.now() + maxAgeMs;
  return certificates;
}

export async function verifyFirebaseIdToken(token: string, projectId: string) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase ID token.');
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeSegment(headerSegment);
  const payload = decodeSegment(payloadSegment);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Unsupported Firebase ID token.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof payload.sub !== 'string' ||
    payload.sub.length === 0 ||
    typeof payload.exp !== 'number' ||
    payload.exp <= now ||
    typeof payload.iat !== 'number' ||
    payload.iat > now
  ) {
    throw new Error('Invalid Firebase ID token claims.');
  }

  const certificate = (await getCertificates()).get(header.kid);
  if (!certificate) {
    certificates = null;
    throw new Error('Unknown Firebase token certificate.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerSegment}.${payloadSegment}`);
  verifier.end();
  if (!verifier.verify(certificate, Buffer.from(signatureSegment, 'base64url'))) {
    throw new Error('Invalid Firebase ID token signature.');
  }

  return payload.sub;
}
