import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { ChatMessage } from '../types';
import { ChatMessageBubble } from './ChatMessageBubble';
import { db } from '../config/firebase';
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { useMessageContext } from '../contexts/MessageContext';

const timestampToMillis = (timestamp: unknown): number => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }

  if (
    timestamp &&
    typeof timestamp === 'object' &&
    'toMillis' in timestamp &&
    typeof timestamp.toMillis === 'function'
  ) {
    return timestamp.toMillis();
  }

  return typeof timestamp === 'number' ? timestamp : 0;
};

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  currentUserId: string;
  currentUserName?: string;
  driverId: string;
  driverName: string;
  isRideActive: boolean;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  isOpen,
  onClose,
  rideId,
  currentUserId,
  currentUserName = 'You',
  driverId,
  driverName,
  isRideActive
}) => {
  const { markMessagesAsRead } = useMessageContext();
  const [messages, setMessages] = useState<Array<{
    id: string; text: string; sender: string; timestamp: number; senderName?: string; read?: boolean;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load cached messages for offline access
  useEffect(() => {
    if (!rideId) return;
    const cached = localStorage.getItem(`messages_${rideId}`);
    if (cached) {
      try {
        setMessages(JSON.parse(cached).sort((a: any, b: any) => a.timestamp - b.timestamp));
      } catch { /* ignore */ }
    }
  }, [rideId]);

  // Listen to Firestore messages/{rideId}/thread in real-time
  useEffect(() => {
    if (!isOpen || !rideId) return;

    const threadRef = collection(db, 'messages', rideId, 'thread');
    const q = query(threadRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(d => ({
        id: d.id,
        text: d.data().text,
        sender: d.data().sender,
        senderName: d.data().senderName,
        timestamp: timestampToMillis(d.data().timestamp),
        read: d.data().read || false,
      }));
      setMessages(loaded);
      localStorage.setItem(`messages_${rideId}`, JSON.stringify(loaded));
    });

    return () => unsubscribe();
  }, [isOpen, rideId]);

  // Mark as read when panel opens
  useEffect(() => {
    if (isOpen && rideId) markMessagesAsRead();
  }, [isOpen, rideId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isRideActive || isSending) return;
    setIsSending(true);
    try {
      const threadRef = collection(db, 'messages', rideId, 'thread');
      await addDoc(threadRef, {
        text: newMessage.trim(),
        sender: 'client',
        senderName: currentUserName,
        senderId: currentUserId,
        timestamp: serverTimestamp(),
        read: true,
        readBy: { [currentUserId]: true },
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-50 max-h-[70vh] flex flex-col will-change-transform"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 300) onClose();
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Messages</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-2"
              style={{ maxHeight: 'calc(70vh - 140px)' }}
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={{
                      id: message.id,
                      senderId: message.sender === 'client' ? currentUserId : driverId,
                      text: message.text,
                      timestamp: message.timestamp,
                      readBy: {},
                    }}
                    isCurrentUser={message.sender === 'client'}
                    senderName={message.sender === 'client' ? 'You' : driverName}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isRideActive ? 'Type a message...' : 'Ride not active'}
                  disabled={!isRideActive || isSending}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isRideActive || isSending}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    newMessage.trim() && isRideActive && !isSending
                      ? 'bg-[#5B2EFF] hover:bg-[#4a25cc] text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
