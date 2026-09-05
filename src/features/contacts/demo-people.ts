export type DemoPerson = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  photoURL?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  accent: string;
  identityId: string;
};

export const demoPeople: DemoPerson[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    handle: '@mayac',
    initials: 'MC',
    accent: '#000000',
    identityId: 'demo-maya',
  },
  {
    id: 'noah',
    name: 'Noah Williams',
    handle: '@noahw',
    initials: 'NW',
    accent: '#000000',
    identityId: 'demo-noah',
  },
  {
    id: 'sofia',
    name: 'Sofia Patel',
    handle: '@sofiap',
    initials: 'SP',
    accent: '#000000',
    identityId: 'demo-sofia',
  },
];

export function getDemoPerson(personId: string | undefined) {
  return demoPeople.find((person) => person.id === personId);
}

export function getInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CN';
}

export function createContactFromIdentity(
  identityId: string,
  displayName = 'Unknown caller',
  photoURL: string | null = null,
  username = identityId.slice(0, 8).toLowerCase(),
): DemoPerson {
  const initials = getInitials(displayName);

  return {
    id: `contact-${identityId}`,
    name: displayName,
    handle: `@${username}`,
    initials,
    photoURL,
    accent: '#000000',
    identityId,
  };
}
