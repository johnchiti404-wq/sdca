import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { database } from '../config/firebase';
import { db as firestore } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { soundManager } from '../utils/notificationSound';

interface MessageContextType {
  unreadMessageCount: number;
  setUnreadMessageCount: (count: number) => void;
  markMessagesAsRead: () => Promise<void>;
  resetUnreadCount: () => void;
}

export const MessageContext = createContext<MessageContextType>({
  unreadMessageCount: 0,
  setUnreadMessageCount: () => {},
  markMessagesAsRead: async () => {},
  resetUnreadCount: () => {},
});

export const useMessageContext = () => useContext(MessageContext);

interface MessageProviderProps {
  userId: string | null;
  rideId: string | null;
  children: React.ReactNode;
}

const timestampToMillis = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return 0;
};

export const MessageProvider: React.FC<MessageProviderProps> = ({ rideId, children }) => {
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const previousUnreadCount = useRef(0);

  useEffect(() => {
    if (!rideId) {
      setUnreadMessageCount(0);
      previousUnreadCount.current = 0;
      return;
    }

    const cachedCount = localStorage.getItem(`unread_${rideId}`);
    if (cachedCount) {
      const parsedCount = parseInt(cachedCount, 10);
      setUnreadMessageCount(parsedCount);
      previousUnreadCount.current = parsedCount;
    }

    const parentRef = doc(firestore, 'messages', rideId);
    const threadRef = collection(firestore, 'messages', rideId, 'thread');
    let lastSeenAt = 0;
    let hasInitialLoad = false;
    let latestMessages: any[] = [];
    let latestThreadLoaded = false;
    let latestSeenLoaded = false;

    const updateUnreadCount = () => {
      if (!latestThreadLoaded || !latestSeenLoaded) return;

      const unreadCount = latestMessages.filter((message) => {
        return message.sender === 'driver' && timestampToMillis(message.timestamp) > lastSeenAt;
      }).length;

      setUnreadMessageCount(unreadCount);
      localStorage.setItem(`unread_${rideId}`, unreadCount.toString());

      if (unreadCount > previousUnreadCount.current && hasInitialLoad) {
        soundManager.play('message');
      }
      previousUnreadCount.current = unreadCount;
      hasInitialLoad = true;
    };

    const unsubscribeSeen = onSnapshot(parentRef, (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;

      const data = snapshot.data();
      lastSeenAt = timestampToMillis(data?.clientLastSeenAt);
      latestSeenLoaded = true;
      updateUnreadCount();
    });

    const unsubscribeThread = onSnapshot(threadRef, (snapshot) => {
      latestMessages = snapshot.docs.map((messageDoc) => ({
        id: messageDoc.id,
        ...messageDoc.data(),
      }));
      latestThreadLoaded = true;
      localStorage.setItem(`messages_${rideId}`, JSON.stringify(latestMessages));
      updateUnreadCount();
    });

    return () => {
      unsubscribeSeen();
      unsubscribeThread();
    };
  }, [rideId]);

  // Ride status remains on RTDB; messaging is handled by Firestore above.
  useEffect(() => {
    if (!rideId) return;

    const statusRef = ref(database, `rides/${rideId}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.val() === 'completed') {
        localStorage.removeItem(`messages_${rideId}`);
        localStorage.removeItem(`unread_${rideId}`);
        localStorage.removeItem(`arrival_notified_${rideId}`);
        setUnreadMessageCount(0);
      }
    });

    return () => off(statusRef, 'value', unsubscribe);
  }, [rideId]);

  const markMessagesAsRead = async () => {
    if (!rideId) return;

    try {
      await setDoc(
        doc(firestore, 'messages', rideId),
        { clientSeen: true, clientLastSeenAt: serverTimestamp() },
        { merge: true },
      );
      setUnreadMessageCount(0);
      previousUnreadCount.current = 0;
      localStorage.setItem(`unread_${rideId}`, '0');
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const resetUnreadCount = () => {
    setUnreadMessageCount(0);
    previousUnreadCount.current = 0;
    if (rideId) localStorage.setItem(`unread_${rideId}`, '0');
  };

  return (
    <MessageContext.Provider value={{ unreadMessageCount, setUnreadMessageCount, markMessagesAsRead, resetUnreadCount }}>
      {children}
    </MessageContext.Provider>
  );
};
