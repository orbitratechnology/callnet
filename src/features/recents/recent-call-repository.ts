import { File, Paths } from 'expo-file-system';

import { demoPeople, type DemoPerson } from '../contacts/demo-people';

export type RecentCallKind = 'voice' | 'video';
export type RecentCallOutcome = 'completed' | 'missed' | 'timed-out' | 'rejected' | 'cancelled' | 'failed';

export type RecentCall = {
  id: string;
  person: DemoPerson;
  kind: RecentCallKind;
  direction: 'incoming' | 'outgoing';
  outcome: RecentCallOutcome;
  timestamp: number;
};

const seedTimestamp = Date.now();

const seededRecentCalls: RecentCall[] = [
  {
    id: 'recent-maya',
    person: demoPeople[0],
    kind: 'voice',
    direction: 'incoming',
    outcome: 'completed',
    timestamp: seedTimestamp - 1000 * 60 * 18,
  },
  {
    id: 'recent-noah',
    person: demoPeople[1],
    kind: 'video',
    direction: 'outgoing',
    outcome: 'completed',
    timestamp: seedTimestamp - 1000 * 60 * 60 * 3,
  },
];

export interface RecentCallRepository {
  load(): RecentCall[];
  add(call: RecentCall): RecentCall[];
}

function isRecentCall(value: unknown): value is RecentCall {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const call = value as Partial<RecentCall>;
  return Boolean(
    typeof call.id === 'string' &&
      typeof call.timestamp === 'number' &&
      (call.kind === 'voice' || call.kind === 'video') &&
      (call.direction === 'incoming' || call.direction === 'outgoing') &&
      call.person &&
      typeof call.person.id === 'string' &&
      typeof call.person.name === 'string',
  );
}

export class MemoryRecentCallRepository implements RecentCallRepository {
  protected calls: RecentCall[];

  constructor(seed: RecentCall[] = seededRecentCalls) {
    this.calls = [...seed];
  }

  load() {
    return [...this.calls];
  }

  add(call: RecentCall) {
    if (this.calls.some((existingCall) => existingCall.id === call.id)) {
      return this.load();
    }

    this.calls = [call, ...this.calls].slice(0, 20);
    return this.load();
  }
}

export class FileRecentCallRepository extends MemoryRecentCallRepository {
  private readonly fileName = 'callnet-recent-calls-v1.json';

  constructor(seed: RecentCall[] = seededRecentCalls) {
    super(seed);

    try {
      const file = this.getFile();
      if (!file.exists) {
        return;
      }

      const storedCalls: unknown = JSON.parse(file.textSync());
      if (Array.isArray(storedCalls)) {
        this.replace(storedCalls.filter(isRecentCall).slice(0, 20));
      }
    } catch {
      // A corrupted or unavailable local file should not block the call UI.
    }
  }

  override add(call: RecentCall) {
    const calls = super.add(call);

    try {
      const file = this.getFile();
      if (!file.exists) {
        file.create({ intermediates: true });
      }
      file.write(JSON.stringify(calls));
    } catch {
      // The in-memory history remains usable if device storage is unavailable.
    }

    return calls;
  }

  private getFile() {
    return new File(Paths.document, this.fileName);
  }

  private replace(calls: RecentCall[]) {
    this.calls = calls;
  }
}

export function createRecentCallRepository() {
  return new FileRecentCallRepository();
}
