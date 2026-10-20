import { useEffect, useState } from 'react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app } from '../config/firebase';
import { firebaseService } from '../services/firebaseService';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function useNotificationPermission(
  uid: string | null,
  onForegroundMessage?: (title: string, body: string) => void,
) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !('Notification' in window) || !('serviceWorker' in navigator)) return;

    let unsubscribeMessage: (() => void) | undefined;
    let cancelled = false;

    const setupMessaging = async () => {
      if (!(await isSupported()) || !vapidKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted' || cancelled) return;

      const registration = await navigator.serviceWorker.ready;
      const messaging = getMessaging(app);
      const nextToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
      if (!nextToken || cancelled) return;

      setToken(nextToken);
      await firebaseService.saveFcmToken(uid, nextToken);
      unsubscribeMessage = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'Aletwende';
        const body = payload.notification?.body || '';
        onForegroundMessage?.(title, body);
      });
    };

    void setupMessaging().catch((error) => {
      console.warn('[v0] Unable to configure push notifications:', error);
    });

    return () => {
      cancelled = true;
      unsubscribeMessage?.();
    };
  }, [uid, onForegroundMessage]);

  return token;
}
