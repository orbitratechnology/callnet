import { router } from 'expo-router';
import {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useRef,
    useState,
    type PropsWithChildren,
} from 'react';

import { useAuth } from '../auth/auth-provider';
import { createContactRepository, type ContactInput, type ContactRepository } from '../contacts/contacts-repository';
import {
    createContactFromIdentity,
    getInitials,
    type DemoPerson,
} from '../contacts/demo-people';
import { ensureUserProfile } from '../profile/profile-service';
import {
    createRecentCallRepository,
    type RecentCall,
    type RecentCallRepository,
} from '../recents/recent-call-repository';
import { getCallTransportMode, getIceServers, getSignalingUrl, type CallTransportMode } from './call-config';
import {
    callReducer,
    createCallSession,
    type CallKind,
    type CallSession,
    type CallState,
} from './call-state';
import { DemoPermissionService, type PermissionService } from './permission-service';
import {
    WebRTCCallController,
    type RealCallControllerEvent,
} from './webrtc-call-controller';
import { setupVoipPushForUser } from './voip-push-service';

export interface CallController {
  startOutgoing(person: DemoPerson, kind: CallKind): Promise<void>;
  simulateIncoming(person: DemoPerson, kind: CallKind): void;
  acceptIncoming(): Promise<void>;
  reject(): void;
  cancel(): void;
  timeout(): void;
  end(): void;
}

type CallContextValue = CallController & {
  session: CallSession | null;
  recentCalls: RecentCall[];
  contacts: DemoPerson[];
  addContact(contact: ContactInput): void;
  transportMode: CallTransportMode;
  transportStatus: 'connecting' | 'connected' | 'offline';
  transportError: string | null;
  retryConnection(): Promise<void>;
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  resetCall(): void;
  toggleMute(): void;
  toggleSpeaker(): void;
  toggleCamera(): void;
  switchCamera(): void;
};

type CallProviderProps = PropsWithChildren<{
  permissionService?: PermissionService;
  recentCallRepository?: RecentCallRepository;
}>;

const CallContext = createContext<CallContextValue | null>(null);
const defaultPermissionService = new DemoPermissionService();
const REAL_OUTGOING_TIMEOUT_MS = 30000;

function isTerminalState(state: CallState) {
  return state === 'ended' || state === 'failed';
}

function isActiveState(state: CallState) {
  return !isTerminalState(state) && state !== 'idle';
}

export function CallProvider({
  children,
  permissionService = defaultPermissionService,
  recentCallRepository,
}: CallProviderProps) {
  const { user, getIdToken } = useAuth();
  const transportMode = getCallTransportMode();
  const [session, dispatch] = useReducer(callReducer, null);
  const [transportStatus, setTransportStatus] = useState<'connecting' | 'connected' | 'offline'>(
    transportMode === 'demo' ? 'connected' : 'connecting',
  );
  const [transportError, setTransportError] = useState<string | null>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const sessionRef = useRef<CallSession | null>(session);
  const permissionServiceRef = useRef(permissionService);
  const recentCallRepositoryRef = useRef<RecentCallRepository | null>(null);
  if (recentCallRepositoryRef.current === null) {
    recentCallRepositoryRef.current = recentCallRepository ?? createRecentCallRepository(user?.uid);
  }
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>(() =>
    recentCallRepositoryRef.current!.load(),
  );
  const contactRepositoryRef = useRef<ContactRepository | null>(null);
  if (contactRepositoryRef.current === null && user) {
    contactRepositoryRef.current = createContactRepository(user.uid);
  }
  const [contacts, setContacts] = useState<DemoPerson[]>(() =>
    contactRepositoryRef.current?.load() ?? [],
  );
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const recordedCallIdsRef = useRef<Set<string>>(new Set());
  const startingCallRef = useRef(false);
  const activeCallIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const pendingIncomingRouteRef = useRef<string | null>(null);
  const realControllerRef = useRef<WebRTCCallController | null>(null);

  sessionRef.current = session;

  const getRealController = async (idToken: string) => {
    if (!user) {
      throw new Error('Sign in before connecting to calls.');
    }
    if (!realControllerRef.current) {
      const profile = await ensureUserProfile(user);
      realControllerRef.current = new WebRTCCallController({
        identity: { mode: 'firebase', uid: user.uid },
        authToken: idToken,
        profile: {
          username: profile.username,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
        },
        signalingUrl: getSignalingUrl(),
          iceServers: await getIceServers(idToken),
      });
    }
    return realControllerRef.current;
  };

  const getConnectedController = async () => getRealController(await getIdToken());

  const clearTimers = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  };

  const scheduleTransition = (
    callId: string,
    state: CallState,
    delay: number,
    expectedStates: CallState[],
    failureReason?: string,
  ) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      const currentSession = sessionRef.current;

      if (
        !mountedRef.current ||
        currentSession?.callId !== callId ||
        !expectedStates.includes(currentSession.state)
      ) {
        return;
      }

      dispatch({ type: 'transition', state, failureReason });
    }, delay);

    timersRef.current.add(timer);
  };

  const scheduleOutgoingSimulation = (call: CallSession) => {
    scheduleTransition(call.callId, 'ringing', 450, ['outgoing']);
    scheduleTransition(call.callId, 'connecting', 1000, ['ringing']);
    scheduleTransition(call.callId, 'connected', 1800, ['connecting']);
  };

  const scheduleConnectedTransition = (call: CallSession) => {
    scheduleTransition(call.callId, 'connected', 900, ['connecting']);
  };

  const handleRealEvent = (event: RealCallControllerEvent) => {
    if (!mountedRef.current) {
      return;
    }

    if (event.type === 'transport') {
      if (event.status === 'connected') {
        setTransportStatus('connected');
      } else if (event.status === 'offline') {
        setTransportStatus('offline');
        setTransportError('Signaling connection lost. Retry when your connection is available.');
      } else {
        setTransportStatus('connecting');
      }
      return;
    }

    if (event.type === 'incoming') {
      const existingContact = contacts.find((contact) => contact.identityId === event.from);
      const person = existingContact
        ? {
            ...existingContact,
            name: event.profile.displayName,
            handle: `@${event.profile.username}`,
            initials: getInitials(event.profile.displayName),
            photoURL: event.profile.photoURL,
          }
        : createContactFromIdentity(
            event.from,
            event.profile.displayName,
            event.profile.photoURL,
            event.profile.username,
          );
      if (sessionRef.current && isActiveState(sessionRef.current.state)) {
        return;
      }

      const call = createCallSession(person, event.kind, 'incoming', event.timestamp, event.callId);
      activeCallIdRef.current = call.callId;
      pendingIncomingRouteRef.current = person.id;
      dispatch({ type: 'start', session: call });
      return;
    }

    if (event.type === 'streams') {
      setLocalStreamUrl(event.localStreamUrl);
      setRemoteStreamUrl(event.remoteStreamUrl);
      return;
    }

    if (event.type === 'controls') {
      if (event.muted !== undefined) {
        dispatch({ type: 'set-mute', muted: event.muted });
      }
      if (event.cameraEnabled !== undefined) {
        dispatch({ type: 'set-camera', enabled: event.cameraEnabled });
      }
      return;
    }

    if (sessionRef.current?.callId !== event.callId) {
      return;
    }

    if (event.state === 'ended' || event.state === 'failed') {
      activeCallIdRef.current = null;
    }
    dispatch({ type: 'transition', state: event.state, failureReason: event.failureReason });
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const personId = pendingIncomingRouteRef.current;
    if (
      !personId ||
      session?.direction !== 'incoming' ||
      session.state !== 'ringing'
    ) {
      return;
    }

    pendingIncomingRouteRef.current = null;
    router.push({ pathname: '/incoming', params: { personId } });
  }, [session?.callId, session?.direction, session?.state]);

  useEffect(() => {
    if (transportMode !== 'webrtc' || !user) {
      return;
    }

    setTransportStatus('connecting');
    setTransportError(null);
    let cancelled = false;
    let controller: WebRTCCallController | null = null;
    let unsubscribe: () => void = () => undefined;

    void getConnectedController()
      .then((nextController) => {
        if (cancelled) {
          return undefined;
        }
        controller = nextController;
        unsubscribe = controller.subscribe(handleRealEvent);
        return controller.connect();
      })
      .then(() => {
        if (!cancelled && mountedRef.current) {
          setTransportStatus('connected');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && mountedRef.current) {
          setTransportStatus('offline');
          setTransportError(error instanceof Error ? error.message : 'Signaling connection failed.');
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
      void controller?.disconnect();
    };
  }, [transportMode, user?.uid]);

  const retryConnection = async () => {
    if (transportMode !== 'webrtc' || !user) {
      return;
    }

    const currentSession = sessionRef.current;
    if (currentSession && isActiveState(currentSession.state)) {
      return;
    }

    setTransportStatus('connecting');
    setTransportError(null);

    try {
      const controller = await getConnectedController();
      await controller.disconnect();
      await controller.connect();
      if (mountedRef.current) {
        setTransportStatus('connected');
      }
    } catch (error: unknown) {
      if (mountedRef.current) {
        setTransportStatus('offline');
        setTransportError(error instanceof Error ? error.message : 'Signaling connection failed.');
      }
    }
  };

  useEffect(() => {
    if (transportMode !== 'webrtc' || !user) {
      return;
    }

    return setupVoipPushForUser(user.uid);
  }, [transportMode, user?.uid]);

  const finish = (failureReason?: string) => {
    const currentSession = sessionRef.current;

    if (!currentSession || !isActiveState(currentSession.state)) {
      return;
    }

    clearTimers();
    activeCallIdRef.current = null;

    if (transportMode === 'webrtc') {
      dispatch({ type: 'transition', state: 'ending', failureReason });
      const controller = realControllerRef.current;
      if (!controller) {
        scheduleTransition(currentSession.callId, 'ended', 220, ['ending'], failureReason);
        return;
      }

      const operation = failureReason === 'rejected'
        ? controller.reject()
        : failureReason === 'cancelled' || failureReason === 'timed-out'
          ? controller.cancel(failureReason === 'timed-out' ? 'timed-out' : 'cancelled')
          : controller.end();
      void operation.catch((error: unknown) => {
        if (!mountedRef.current) {
          return;
        }

        dispatch({
          type: 'transition',
          state: 'failed',
          failureReason: error instanceof Error ? error.message : 'webrtc-end-failed',
        });
      });
      return;
    }

    dispatch({ type: 'transition', state: 'ending', failureReason });
    scheduleTransition(currentSession.callId, 'ended', 220, ['ending'], failureReason);
  };

  const scheduleRealOutgoingTimeout = (callId: string) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      const currentSession = sessionRef.current;

      if (
        !mountedRef.current ||
        currentSession?.callId !== callId ||
        !['outgoing', 'ringing', 'connecting'].includes(currentSession.state)
      ) {
        return;
      }

      finish('timed-out');
    }, REAL_OUTGOING_TIMEOUT_MS);

    timersRef.current.add(timer);
  };

  const startOutgoing = async (person: DemoPerson, kind: CallKind) => {
    const currentSession = sessionRef.current;

    if (startingCallRef.current || (currentSession && isActiveState(currentSession.state))) {
      return;
    }

    startingCallRef.current = true;
    clearTimers();
    const call = createCallSession(person, kind, 'outgoing');
    activeCallIdRef.current = call.callId;
    dispatch({ type: 'start', session: call });

    if (transportMode === 'webrtc') {
      try {
        await getConnectedController().then((controller) => controller.startOutgoing({
          callId: call.callId,
          peerId: person.identityId,
          kind,
          peerProfile: {
            username: person.handle.replace(/^@/, ''),
            displayName: person.name,
            photoURL: person.photoURL ?? null,
          },
        }));
        if (mountedRef.current && activeCallIdRef.current === call.callId) {
          scheduleRealOutgoingTimeout(call.callId);
        }
      } catch (error) {
        if (mountedRef.current && activeCallIdRef.current === call.callId) {
          activeCallIdRef.current = null;
          dispatch({
            type: 'transition',
            state: 'failed',
            failureReason: error instanceof Error ? error.message : 'webrtc-start-failed',
          });
        }
      } finally {
        startingCallRef.current = false;
      }
      return;
    }

    const permission = await permissionServiceRef.current.request(kind === 'video' ? 'video' : 'audio');
    startingCallRef.current = false;

    if (permission === 'denied') {
      if (activeCallIdRef.current !== call.callId) {
        return;
      }

      activeCallIdRef.current = null;
      dispatch({
        type: 'transition',
        state: 'failed',
        failureReason: `${kind}-permission-denied`,
      });
      return;
    }

    if (activeCallIdRef.current !== call.callId) {
      return;
    }

    const currentSessionAfterPermission = sessionRef.current;
    if (
      currentSessionAfterPermission?.callId === call.callId &&
      !isActiveState(currentSessionAfterPermission.state)
    ) {
      return;
    }

    scheduleOutgoingSimulation(call);
  };

  const simulateIncoming = (person: DemoPerson, kind: CallKind) => {
    if (transportMode === 'webrtc') {
      return;
    }

    const currentSession = sessionRef.current;
    if (currentSession && isActiveState(currentSession.state)) {
      return;
    }

    clearTimers();
    const call = createCallSession(person, kind, 'incoming');
    activeCallIdRef.current = call.callId;
    dispatch({ type: 'start', session: call });
  };

  const acceptIncoming = async () => {
    const currentSession = sessionRef.current;

    if (!currentSession || currentSession.direction !== 'incoming' || currentSession.state !== 'ringing') {
      return;
    }

    if (transportMode === 'webrtc') {
      try {
        await getConnectedController().then((controller) => controller.acceptIncoming());
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        dispatch({
          type: 'transition',
          state: 'failed',
          failureReason: error instanceof Error ? error.message : 'webrtc-accept-failed',
        });
      }
      return;
    }

    const permission = await permissionServiceRef.current.request(
      currentSession.kind === 'video' ? 'video' : 'audio',
    );

    if (permission === 'denied') {
      if (activeCallIdRef.current !== currentSession.callId) {
        return;
      }

      activeCallIdRef.current = null;
      dispatch({
        type: 'transition',
        state: 'failed',
        failureReason: `${currentSession.kind}-permission-denied`,
      });
      return;
    }

    if (sessionRef.current?.callId !== currentSession.callId || sessionRef.current.state !== 'ringing') {
      return;
    }

    dispatch({ type: 'transition', state: 'connecting' });
    scheduleConnectedTransition(currentSession);
  };

  const reject = () => finish('rejected');
  const cancel = () => finish('cancelled');
  const timeout = () => finish('timed-out');
  const end = () => finish();

  const resetCall = () => {
    clearTimers();
    activeCallIdRef.current = null;
    dispatch({ type: 'reset' });
  };

  const addContact = (contact: ContactInput) => {
    if (!contactRepositoryRef.current) {
      return;
    }
    setContacts(contactRepositoryRef.current.add(contact));
  };

  useEffect(() => {
    if (!session || !isTerminalState(session.state)) {
      return;
    }

    if (recordedCallIdsRef.current.has(session.callId)) {
      return;
    }

    recordedCallIdsRef.current.add(session.callId);
    const outcome =
      session.state === 'failed'
        ? 'failed'
        : session.failureReason === 'rejected'
          ? 'rejected'
          : session.failureReason === 'cancelled'
            ? 'cancelled'
            : session.failureReason === 'timed-out'
              ? 'timed-out'
              : session.connectedAt
                ? 'completed'
                : 'missed';

    setRecentCalls(
      recentCallRepositoryRef.current!.add({
        id: session.callId,
        person: session.person,
        kind: session.kind,
        direction: session.direction,
        outcome,
        timestamp: session.endedAt ?? Date.now(),
      }),
    );
  }, [session]);

  useEffect(() => {
    return () => {
      clearTimers();
      void realControllerRef.current?.disconnect();
    };
  }, []);

  const value: CallContextValue = {
    session,
    recentCalls,
    contacts,
    addContact,
    transportMode,
    transportStatus,
    transportError,
    retryConnection,
    localStreamUrl,
    remoteStreamUrl,
    startOutgoing,
    simulateIncoming,
    acceptIncoming,
    reject,
    cancel,
    timeout,
    end,
    resetCall,
    toggleMute: () => {
      dispatch({ type: 'toggle-mute' });
      if (transportMode === 'webrtc' && realControllerRef.current && session) {
        realControllerRef.current.setMuted(!session.isMuted);
      }
    },
    toggleSpeaker: () => {
      dispatch({ type: 'toggle-speaker' });
      if (transportMode === 'webrtc' && realControllerRef.current && session) {
        realControllerRef.current.setSpeakerEnabled(!session.isSpeakerEnabled);
      }
    },
    toggleCamera: () => {
      dispatch({ type: 'toggle-camera' });
      if (transportMode === 'webrtc' && realControllerRef.current && session) {
        realControllerRef.current.setCameraEnabled(!session.isCameraEnabled);
      }
    },
    switchCamera: () => {
      dispatch({ type: 'switch-camera' });
      if (transportMode === 'webrtc') {
        realControllerRef.current?.switchCamera();
      }
    },
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error('useCall must be used inside CallProvider');
  }

  return context;
}
