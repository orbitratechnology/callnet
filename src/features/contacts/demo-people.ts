export type DemoPerson = {
  id: string;
  name: string;
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
    initials: 'MC',
    accent: '#000000',
    identityId: 'demo-maya',
    phoneNumber: '+15550100001',
  },
  {
    id: 'noah',
    name: 'Noah Williams',
    initials: 'NW',
    accent: '#000000',
    identityId: 'demo-noah',
    phoneNumber: '+15550100002',
  },
  {
    id: 'sofia',
    name: 'Sofia Patel',
    initials: 'SP',
    accent: '#000000',
    identityId: 'demo-sofia',
    phoneNumber: '+15550100003',
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
  phoneNumber = '',
  email: string | null = null,
): DemoPerson {
  const initials = getInitials(displayName);

  return {
    id: `contact-${identityId}`,
    name: displayName,
    initials,
    photoURL,
    email,
    phoneNumber,
    accent: '#000000',
    identityId,
  };
}
