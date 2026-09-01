import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  getDemoPersonForDevelopmentIdentity,
  type DemoPerson,
} from '../contacts/demo-people';
import {
  callReducer,
  createCallSession,
  type CallKind,
  type CallSession,
  type CallState,
} from './call-state';
import {
  createRecentCallRepository,
  type RecentCall,
  type RecentCallRepository,
} from '../recents/recent-call-repository';
import { DemoPermissionService, type PermissionService } from './permission-service';
import {
  getCallTransportMode,
  getDevelopmentIdentity,
  getIceServers,
  getSignalingUrl,
  type CallTransportMode,
} from './dev-identity';
import {
  WebRTCCallController,
  type RealCallControllerEvent,
} from './webrtc-call-controller';

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
  transportMode: CallTransportMode;
  transportError: string | null;
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
  const [session, dispatch] = useReducer(callReducer, null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const sessionRef = useRef<CallSession | null>(session);
  const permissionServiceRef = useRef(permissionService);
  const recentCallRepositoryRef = useRef<RecentCallRepository | null>(null);
  if (recentCallRepositoryRef.current === null) {
    recentCallRepositoryRef.current = recentCallRepository ?? createRecentCallRepository();
  }
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>(() =>
    recentCallRepositoryRef.current!.load(),
  );
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const recordedCallIdsRef = useRef<Set<string>>(new Set());
  const startingCallRef = useRef(false);
  const activeCallIdRef = useRef<string | null>(null);
  const realControllerRef = useRef<WebRTCCallController | null>(null);
  const transportMode = getCallTransportMode();

  sessionRef.current = session;

  const getRealController = () => {
    if (!realControllerRef.current) {
      realControllerRef.current = new WebRTCCallController({
        identity: getDevelopmentIdentity(),
        signalingUrl: getSignalingUrl(),
        iceServers: getIceServers(),
      });
    }
    return realControllerRef.current;
  };

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
    if (event.type === 'incoming') {
      const person = getDemoPersonForDevelopmentIdentity(event.from);
      if (!person || (sessionRef.current && isActiveState(sessionRef.current.state))) {
        return;
      }

      const call = createCallSession(person, event.kind, 'incoming', event.timestamp, event.callId);
      activeCallIdRef.current = call.callId;
      dispatch({ type: 'start', session: call });
      router.push({ pathname: '/call', params: { personId: person.id } });
      return;
    }

    if (event.type === 'streams') {
      setLocalStreamUrl(event.localStreamUrl);
      setRemoteStreamUrl(event.remoteStreamUrl);
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
    if (transportMode !== 'webrtc') {
      return;
    }

    let controller: WebRTCCallController;
    try {
      controller = getRealController();
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : 'WebRTC is unavailable.');
      return;
    }

    const unsubscribe = controller.subscribe(handleRealEvent);
    void controller.connect().catch((error: unknown) => {
      setTransportError(error instanceof Error ? error.message : 'Signaling connection failed.');
    });

    return () => {
      unsubscribe();
      void controller.disconnect();
    };
  }, [transportMode]);

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
          ? controller.cancel()
          : controller.end();
      void operation.catch((error: unknown) => {
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
        await getRealController().startOutgoing({
          callId: call.callId,
          peerId: person.developmentIdentityId,
          kind,
        });
      } catch (error) {
        if (activeCallIdRef.current === call.callId) {
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
        await getRealController().acceptIncoming();
      } catch (error) {
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
    transportMode,
    transportError,
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
