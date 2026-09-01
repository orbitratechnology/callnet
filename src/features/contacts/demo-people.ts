import type { DevelopmentIdentityId } from '../../../shared/call-protocol';

export type DemoPerson = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  accent: string;
  developmentIdentityId: DevelopmentIdentityId;
};

export const demoPeople: DemoPerson[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    handle: '@mayac',
    initials: 'MC',
    accent: '#9B8AFB',
    developmentIdentityId: 'device-b',
  },
  {
    id: 'noah',
    name: 'Noah Williams',
    handle: '@noahw',
    initials: 'NW',
    accent: '#F2A65A',
    developmentIdentityId: 'device-a',
  },
  {
    id: 'sofia',
    name: 'Sofia Patel',
    handle: '@sofiap',
    initials: 'SP',
    accent: '#54C2A4',
    developmentIdentityId: 'device-b',
  },
];

export function getDemoPerson(personId: string | undefined) {
  return demoPeople.find((person) => person.id === personId);
}

export function getDemoPersonForDevelopmentIdentity(identityId: DevelopmentIdentityId) {
  return demoPeople.find((person) => person.developmentIdentityId === identityId);
}
