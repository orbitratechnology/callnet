import {
  Contact,
  ContactField,
  ContactsSortOrder,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-contacts';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import { normalizePhoneNumber } from '@/features/profile/profile-service';
import type { ContactMatchRequest } from '@/features/profile/profile-service';

export type DeviceContact = ContactMatchRequest & {
  name: string;
  email: string | null;
  phoneNumber: string | null;
};

export type DeviceContactsPermission = {
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function identifierValue(value: string, kind: 'email' | 'phone') {
  return kind === 'phone' ? normalizePhoneNumber(value) : normalizeEmail(value);
}

async function hashIdentifier(value: string) {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, value);
}

function permissionResult(result: Awaited<ReturnType<typeof getPermissionsAsync>>): DeviceContactsPermission {
  return {
    granted: Boolean(result.granted),
    canAskAgain: result.canAskAgain !== false,
    accessPrivileges: result.accessPrivileges,
  };
}

export async function getDeviceContactsPermission() {
  return permissionResult(await getPermissionsAsync());
}

export async function requestDeviceContactsPermission() {
  return permissionResult(await requestPermissionsAsync());
}

export async function readDeviceContacts(): Promise<DeviceContact[]> {
  const fields = [ContactField.FULL_NAME, ContactField.EMAILS, ContactField.PHONES] as const;
  const contacts = await Contact.getAllDetails(fields, { limit: 500, sortOrder: ContactsSortOrder.GivenName });

  return (
    await Promise.all(
      contacts.map(async (contact) => {
        const emails = contact.emails?.map((item) => item.address?.trim()).filter((value): value is string => Boolean(value)) ?? [];
        const phoneNumbers = contact.phones?.map((item) => item.number?.trim()).filter((value): value is string => Boolean(value)) ?? [];
        const email = emails[0] ?? null;
        const phoneNumber = phoneNumbers[0] ?? null;
        const identifiers = [
          ...emails.map((value) => ({ value: identifierValue(value, 'email') })),
          ...phoneNumbers.map((value) => ({ value: identifierValue(value, 'phone') })),
        ].filter((item) => item.value.length > 0);

        if (identifiers.length === 0) {
          return null;
        }

        const tokens = await Promise.all([...new Set(identifiers.map((item) => item.value))].map(hashIdentifier));
        const deviceContact: DeviceContact = {
          contactId: contact.id,
          name: contact.fullName?.trim() || phoneNumber || email || 'Unnamed contact',
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          tokens,
        };
        return deviceContact;
      }),
    )
  ).filter((contact): contact is DeviceContact => contact !== null);
}
