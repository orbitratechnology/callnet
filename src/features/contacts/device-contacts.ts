import {
  Contact,
  ContactField,
  ContactsSortOrder,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-contacts';

import { hashPhoneNumber, normalizePhoneNumber } from '@/features/profile/profile-service';
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
        const normalizedPhoneNumbers = [...new Set(phoneNumbers.map((value) => normalizePhoneNumber(value)))].filter(Boolean);

        if (normalizedPhoneNumbers.length === 0) {
          return null;
        }

        const tokens = await Promise.all(normalizedPhoneNumbers.map(hashPhoneNumber));
        const phoneNumber = normalizedPhoneNumbers[0] ?? null;
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
