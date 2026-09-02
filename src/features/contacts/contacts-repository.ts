import { File, Paths } from 'expo-file-system';

import type { DemoPerson } from './demo-people';

export type ContactInput = Omit<DemoPerson, 'id'>;

function isContact(value: unknown): value is DemoPerson {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const contact = value as Partial<DemoPerson>;
  return Boolean(
    typeof contact.id === 'string' &&
      typeof contact.name === 'string' &&
      typeof contact.identityId === 'string' &&
      typeof contact.initials === 'string',
  );
}

export interface ContactRepository {
  load(): DemoPerson[];
  add(contact: ContactInput): DemoPerson[];
}

export class FileContactRepository implements ContactRepository {
  private contacts: DemoPerson[];
  private readonly file: File;

  constructor(ownerId: string) {
    this.file = new File(Paths.document, `callnet-contacts-v1-${ownerId}.json`);
    this.contacts = this.read();
  }

  load() {
    return [...this.contacts];
  }

  add(contact: ContactInput) {
    const nextContact: DemoPerson = {
      ...contact,
      id: `contact-${contact.identityId}`,
    };
    this.contacts = [nextContact, ...this.contacts.filter((item) => item.identityId !== contact.identityId)];
    this.write();
    return this.load();
  }

  private read() {
    try {
      if (!this.file.exists) {
        return [];
      }
      const stored: unknown = JSON.parse(this.file.textSync());
      return Array.isArray(stored) ? stored.filter(isContact).slice(0, 100) : [];
    } catch {
      return [];
    }
  }

  private write() {
    try {
      if (!this.file.exists) {
        this.file.create({ intermediates: true });
      }
      this.file.write(JSON.stringify(this.contacts));
    } catch {
      // Keep the in-memory contact list usable if storage is unavailable.
    }
  }
}

export function createContactRepository(ownerId: string) {
  return new FileContactRepository(ownerId.replace(/[^a-zA-Z0-9_-]/g, '_'));
}
