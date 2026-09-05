const SENSITIVE_QUERY_PARAMETER = /([?&](?:apiKey|token|credential|password|secret)=)[^&\s]+/gi;
const BEARER_TOKEN = /(Bearer\s+)[^\s]+/gi;
const URL_VALUE = /https?:\/\/[^\s]+/gi;
const LONG_VALUE = /\b[A-Za-z0-9+/=_-]{32,}\b/g;

export function redactDiagnostic(value: unknown, maxLength = 180): string {
  const message = value instanceof Error ? value.message : value == null ? '' : String(value);
  return message
    .replace(SENSITIVE_QUERY_PARAMETER, '$1[redacted]')
    .replace(BEARER_TOKEN, '$1[redacted]')
    .replace(URL_VALUE, '[redacted-url]')
    .replace(LONG_VALUE, '[redacted-value]')
    .slice(0, maxLength);
}

export function redactIdentifier(value: string): string {
  if (value.length <= 8) {
    return '[redacted-id]';
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
