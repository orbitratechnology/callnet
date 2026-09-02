import { importX509, jwtVerify } from 'jose';

const FIREBASE_CERTIFICATES_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MAX_TOKEN_LENGTH = 10_000;
const CLOCK_SKEW_SECONDS = 30;
const MAX_UID_LENGTH = 128;

type FirebaseCertificates = Record<string, string>;
type CertificateCache = {
  expiresAt: number;
  certificates: Map<string, string>;
};

let certificateCache: CertificateCache | null = null;
let certificateRequest: Promise<CertificateCache> | null = null;

function cacheLifetimeMilliseconds(cacheControl: string | null): number {
  const maxAge = cacheControl?.match(/(?:^|,\s*)max-age=(\d+)/i)?.[1];
  const seconds = maxAge ? Number(maxAge) : 300;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : 300_000;
}

async function loadCertificates(): Promise<CertificateCache> {
  const response = await fetch(FIREBASE_CERTIFICATES_URL);
  if (!response.ok) {
    throw new Error(`Firebase certificate request failed with status ${response.status}.`);
  }

  const certificates = (await response.json()) as FirebaseCertificates;
  const entries = Object.entries(certificates).filter(
    ([keyId, certificate]) =>
      /^[A-Za-z0-9_-]{1,128}$/.test(keyId) && typeof certificate === 'string' && certificate.length > 0,
  );

  return {
    expiresAt: Date.now() + cacheLifetimeMilliseconds(response.headers.get('cache-control')),
    certificates: new Map(entries),
  };
}

async function getCertificates(): Promise<CertificateCache> {
  if (certificateCache && certificateCache.expiresAt > Date.now()) {
    return certificateCache;
  }

  certificateRequest ??= loadCertificates().then((cache) => {
    certificateCache = cache;
    certificateRequest = null;
    return cache;
  });

  try {
    return await certificateRequest;
  } catch (error) {
    certificateRequest = null;
    throw error;
  }
}

function getAuthTime(payload: Record<string, unknown>): number | null {
  return typeof payload.auth_time === 'number' && Number.isFinite(payload.auth_time)
    ? payload.auth_time
    : null;
}

function assertFirebaseTimeClaims(payload: Record<string, unknown>): void {
  const now = Math.floor(Date.now() / 1_000);
  const issuedAt = payload.iat;
  const expiresAt = payload.exp;
  const authTime = getAuthTime(payload);

  if (
    typeof issuedAt !== 'number' ||
    !Number.isFinite(issuedAt) ||
    issuedAt > now + CLOCK_SKEW_SECONDS ||
    typeof expiresAt !== 'number' ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now - CLOCK_SKEW_SECONDS ||
    authTime === null ||
    authTime > now + CLOCK_SKEW_SECONDS
  ) {
    throw new Error('Firebase token time claims are invalid.');
  }
}

async function resolveCertificate(protectedHeader: { alg?: string; kid?: string }) {
  if (protectedHeader.alg !== 'RS256' || typeof protectedHeader.kid !== 'string') {
    throw new Error('Firebase token header is invalid.');
  }

  const cache = await getCertificates();
  const certificate = cache.certificates.get(protectedHeader.kid);
  if (!certificate) {
    certificateCache = null;
    throw new Error('Firebase token signing key is unknown.');
  }

  return importX509(certificate, 'RS256');
}

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<string> {
  if (!projectId || !token || token.length > MAX_TOKEN_LENGTH) {
    throw new Error('Firebase token input is invalid.');
  }

  const { payload } = await jwtVerify(token, resolveCertificate, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    clockTolerance: CLOCK_SKEW_SECONDS,
  });

  assertFirebaseTimeClaims(payload);

  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > MAX_UID_LENGTH) {
    throw new Error('Firebase token subject is invalid.');
  }

  return payload.sub;
}
