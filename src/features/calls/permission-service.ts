export type CallPermissionStatus = 'granted' | 'denied';

export type CallPermissionKind = 'audio' | 'video';

export interface PermissionService {
  request(kind: CallPermissionKind): Promise<CallPermissionStatus>;
}

export class DemoPermissionService implements PermissionService {
  private readonly permissions: Record<CallPermissionKind, CallPermissionStatus>;

  constructor(
    permissions: Partial<Record<CallPermissionKind, CallPermissionStatus>> = {},
  ) {
    this.permissions = {
      audio: permissions.audio ?? 'granted',
      video: permissions.video ?? 'granted',
    };
  }

  async request(kind: CallPermissionKind) {
    return this.permissions[kind];
  }
}
