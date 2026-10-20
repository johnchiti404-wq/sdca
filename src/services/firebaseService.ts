import { database } from '../config/firebase';
import { db } from '../config/firebase';
import { ref, push, set, onValue, off, remove, get, update } from 'firebase/database';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, query, orderBy, getDocs, writeBatch, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { RideRequest, UserProfile, DriverInfo, ChatMessage, DriverLocation } from '../types';

const TEST_DRIVER_ID = 'T8GhAVunanZmkz3QMfPZfRsCdzJ2';

class FirebaseService {
  /**
   * @deprecated Use createOrder from orderService instead
   */
  async createRideRequest(_rideData: Omit<RideRequest, 'id' | 'timestamp'>): Promise<string> {
    console.warn('[v0] DEPRECATED: createRideRequest is deprecated. Use createOrder from orderService instead.');
    throw new Error('createRideRequest is deprecated. Use createOrder from orderService instead.');
  }

  async updateRideStatus(rideId: string, status: RideRequest['status']): Promise<void> {
    const rideStatusRef = ref(database, `rides/${rideId}/status`);
    await set(rideStatusRef, status);
  }

  async cancelRideRequest(rideId: string): Promise<void> {
    await this.updateRideStatus(rideId, 'cancelled');
  }

  async saveCancellationReason(rideId: string, reason: string, userId: string, userName: string): Promise<void> {
    if (!rideId) throw new Error('Missing rideId for cancellation');
    const cancellationRef = ref(database, `cancellations/${rideId}`);
    await set(cancellationRef, { rideId, cancelledReason: reason, cancelledAt: Date.now(), userId, userName });
  }

  async findActiveRideByUser(userId: string): Promise<string | null> {
    const ridesRef = ref(database, 'rides');
    const snapshot = await get(ridesRef);
    if (!snapshot.exists()) return null;
    let latestId: string | null = null;
    let latestTimestamp = 0;
    snapshot.forEach((childSnap) => {
      const r = childSnap.val();
      const id = childSnap.key;
      if (r && r.userId === userId && r.status === 'pending') {
        if (!latestId || r.timestamp > latestTimestamp) {
          latestTimestamp = r.timestamp;
          latestId = id!;
        }
      }
    });
    return latestId;
  }

  listenToRideRequest(rideId: string, callback: (ride: RideRequest | null) => void) {
    const rideRef = ref(database, `rides/${rideId}`);
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const rideData = snapshot.val();
      callback(rideData ? { ...rideData, id: rideId } : null);
    });
    return () => off(rideRef, 'value', unsubscribe);
  }

  // ── User Profile — Firestore ─────────────────────────────────────────────────
  async saveUserProfile(userId: string, profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const existing = await getDoc(userRef);
    const now = Date.now();
    const data: UserProfile = {
      ...profile,
      id: userId,
      createdAt: existing.exists() ? (existing.data().createdAt ?? now) : now,
      updatedAt: now,
    };
    await setDoc(userRef, data, { merge: true });
  }

  async saveFcmToken(uid: string, token: string): Promise<void> {
    await setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', userId);
    const snapshot = await getDoc(userRef);
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  }

  listenToUserProfile(userId: string, callback: (profile: UserProfile | null) => void) {
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    });
    return unsubscribe;
  }

  async getDriverInfo(driverId: string): Promise<DriverInfo | null> {
    const driverRef = ref(database, `drivers/${driverId}`);
    const snapshot = await get(driverRef);
    return snapshot.exists() ? snapshot.val() : null;
  }

  // Ride status (RTDB)
  listenToRideStatus(rideId: string, callback: (status: { status: string; driverId?: string } | null) => void) {
    const rideStatusRef = ref(database, `rides/${rideId}`);
    const unsubscribe = onValue(rideStatusRef, (snapshot) => {
      const rideData = snapshot.val();
      callback(rideData ? { status: rideData.status, driverId: rideData.driverId } : null);
    });
    return () => off(rideStatusRef, 'value', unsubscribe);
  }

  async startRide(rideId: string): Promise<void> {
    await set(ref(database, `rides/${rideId}/status`), 'started');
  }

  listenToDriverLocation(driverId: string, callback: (location: DriverLocation | null) => void) {
    const locationRef = ref(database, `drivers/${driverId}/operation`);
    const unsubscribe = onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.lat && data.lng) {
        callback({ lat: data.lat, lng: data.lng, timestamp: data.timestamp || Date.now() });
      } else {
        callback(null);
      }
    });
    return () => off(locationRef, 'value', unsubscribe);
  }

  // ── Messages — Firestore ─────────────────────────────────────────────────────
  // Path: messages/{rideId}/thread/{messageId}
  async sendMessage(rideId: string, senderId: string, text: string, sender: 'driver' | 'client', senderName?: string): Promise<string> {
    const threadRef = collection(db, 'messages', rideId, 'thread');
    const message = {
      senderId,
      sender,
      senderName: senderName || (sender === 'client' ? 'Client' : 'Driver'),
      text,
      timestamp: serverTimestamp(),
      read: sender === 'client',
      readBy: { [senderId]: true },
    };
    const docRef = await addDoc(threadRef, message);
    return docRef.id;
  }

  listenToMessages(rideId: string, callback: (message: ChatMessage) => void) {
    const threadRef = collection(db, 'messages', rideId, 'thread');
    const q = query(threadRef, orderBy('timestamp', 'asc'));

    let seenIds = new Set<string>();
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !seenIds.has(change.doc.id)) {
          seenIds.add(change.doc.id);
          const data = change.doc.data();
          callback({ id: change.doc.id, ...data } as ChatMessage);
        }
      });
    });
    return unsubscribe;
  }

  async markMessageAsRead(rideId: string, messageId: string, userId: string): Promise<void> {
    const msgRef = doc(db, 'messages', rideId, 'thread', messageId);
    await updateDoc(msgRef, { read: true, [`readBy.${userId}`]: true });
  }

  async markAllMessagesAsRead(rideId: string): Promise<void> {
    const threadRef = collection(db, 'messages', rideId, 'thread');
    const snapshot = await getDocs(query(threadRef));
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      const data = d.data();
      if (data.sender === 'driver' && !data.read) {
        batch.update(d.ref, { read: true });
      }
    });
    await batch.commit();
  }

  async getAllMessages(rideId: string): Promise<ChatMessage[]> {
    const threadRef = collection(db, 'messages', rideId, 'thread');
    const snapshot = await getDocs(query(threadRef, orderBy('timestamp', 'asc')));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
  }

  async clearRideMessages(rideId: string): Promise<void> {
    const threadRef = collection(db, 'messages', rideId, 'thread');
    const snapshot = await getDocs(threadRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    localStorage.removeItem(`messages_${rideId}`);
    localStorage.removeItem(`unread_${rideId}`);
  }

  listenToRideCompletion(rideId: string, callback: (completed: boolean) => void) {
    const statusRef = ref(database, `rides/${rideId}/status`);
    const unsubscribe = onValue(statusRef, async (snapshot) => {
      const status = snapshot.val();
      if (status === 'completed') {
        await this.clearRideMessages(rideId);
        callback(true);
      }
    });
    return () => off(statusRef, 'value', unsubscribe);
  }

  async submitRating(driverUid: string, rideId: string, score: number, comment: string, userId: string): Promise<void> {
    const ratingRef = ref(database, `ratings/${driverUid}/${rideId}`);
    await set(ratingRef, { score, comment, userId, timestamp: Date.now() });

    const driverRef = ref(database, `drivers/${driverUid}`);
    const driverSnapshot = await get(driverRef);
    if (driverSnapshot.exists()) {
      const driverData = driverSnapshot.val();
      const existingAverage = driverData.rating || 0;
      const existingCount = driverData.ratingCount || 0;
      const updatedCount = existingCount + 1;
      const updatedAverage = (existingAverage * existingCount + score) / updatedCount;
      await update(driverRef, { rating: parseFloat(updatedAverage.toFixed(2)), ratingCount: updatedCount });
    } else {
      await update(driverRef, { rating: score, ratingCount: 1 });
    }
    await update(ref(database, `rides/${rideId}`), { rated: true });
  }

  listenToDriverLocationAndETA(
    rideId: string,
    callback: (data: { location: { lat: number; lng: number }; eta: string }) => void
  ) {
    const rideRef = ref(database, `rides/${rideId}`);
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const rideData = snapshot.val();
      if (!rideData || !rideData.driverLocation) return;
      const { lat, lng } = rideData.driverLocation;
      const eta = rideData.driverETA || '3 mins';
      callback({ location: { lat, lng }, eta });
    });
    return () => off(rideRef, 'value', unsubscribe);
  }
}

export const firebaseService = new FirebaseService();
