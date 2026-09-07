import { getLocales } from 'expo-localization';
import parsePhoneNumberFromString, { type CountryCode } from 'libphonenumber-js/max';
import type { ICountryCca2 } from 'rn-international-phone-number';

function getDeviceCountry(): ICountryCca2 {
  const regionCode = getLocales()[0]?.regionCode?.toUpperCase();
  return regionCode && /^[A-Z]{2}$/.test(regionCode) ? regionCode as ICountryCca2 : 'US';
}

export function getDefaultPhoneCountry(): ICountryCca2 {
  return getDeviceCountry();
}

export function normalizePhoneNumber(value: string, defaultCountry = getDeviceCountry()) {
  const input = value.trim();
  if (!input) {
    return '';
  }

  const parsed = parsePhoneNumberFromString(
    input,
    input.startsWith('+') ? undefined : defaultCountry as CountryCode,
  );
  if (parsed) {
    return parsed.number;
  }

  return input.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

export function isValidPhoneNumber(value: string, defaultCountry = getDeviceCountry()) {
  const normalized = normalizePhoneNumber(value, defaultCountry);
  const parsed = parsePhoneNumberFromString(normalized, defaultCountry as CountryCode);
  return Boolean(parsed?.isValid() && parsed.number === normalized);
}
