import AgoraRTC, { type IAgoraRTCClient, type ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { auth } from '../config/firebase';

const API_BASE = 'https://aletwend-render-backend.onrender.com/api/calls';

export interface ActiveCall {
  leave: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  micAvailable: boolean;
  enableMicrophone: () => Promise<boolean>;
}

export interface CallCredentials {
  callId?: string;
  channel: string;
  appId: string;
  token: string;
  uid: string | number | null;
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to call');
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { success?: boolean; error?: string } & T;
  if (!response.ok || data.success === false) throw new Error(data.error || `Call request failed (${response.status})`);
  return data;
}

export const startCall = (orderId: string) => request<CallCredentials>('/start', { orderId });
export const acceptCall = (callId: string) => request<CallCredentials>('/accept', { callId });
export const declineCall = (callId: string) => request<{ success: boolean }>('/decline', { callId });
export const endCall = (callId: string, reason?: string) => request<{ success: boolean }>('/end', { callId, ...(reason ? { reason } : {}) });

export async function getMicPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' ||
    !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  if (!navigator.permissions?.query) return 'prompt';
  try {
    const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return permission.state === 'granted' || permission.state === 'denied' ? permission.state : 'prompt';
  } catch {
    return 'prompt';
  }
}

export async function primeMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

export async function joinChannel(
  credentials: CallCredentials,
  onRemoteAudio?: () => void,
): Promise<ActiveCall> {
  const client: IAgoraRTCClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  let localAudioTrack: ILocalAudioTrack | null = null;
  let micAvailable = false;
  let microphonePublished = false;
  try {
    localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
  } catch {
    // Still join so the caller can hear remote audio without a local microphone.
  }
  let left = false;
  client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'audio' && user.audioTrack) {
      user.audioTrack.play();
      onRemoteAudio?.();
    }
  });
  try {
    await client.join(credentials.appId, credentials.channel, credentials.token, credentials.uid);
    if (localAudioTrack) {
      await client.publish([localAudioTrack]);
      microphonePublished = true;
      micAvailable = true;
    }
  } catch (error) {
    localAudioTrack?.close();
    await client.leave().catch(() => undefined);
    throw error;
  }
  return {
    micAvailable,
    enableMicrophone: async () => {
      if (micAvailable && localAudioTrack) return true;
      try {
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await client.publish([localAudioTrack]);
        microphonePublished = true;
        micAvailable = true;
        return true;
      } catch {
        localAudioTrack?.close();
        localAudioTrack = null;
        microphonePublished = false;
        micAvailable = false;
        return false;
      }
    },
    setMuted: async (muted) => {
      if (localAudioTrack && microphonePublished) await localAudioTrack.setEnabled(!muted);
    },
    leave: async () => {
      if (left) return;
      left = true;
      localAudioTrack?.close();
      await client.leave();
    },
  };
}

export default joinChannel;
