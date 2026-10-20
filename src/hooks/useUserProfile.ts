import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from '../types';

// Cloudinary unsigned upload config for profile photos.
// Cloud name is the account's cloud name (not just the preset name) —
// double check this against the Cloudinary dashboard if uploads 404.
const CLOUDINARY_CLOUD_NAME = 'dexo5rpxb';
const CLOUDINARY_UPLOAD_PRESET = 'client_uploads';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const useUserProfile = (userId?: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveUserId = userId || '';

  useEffect(() => {
    if (!effectiveUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const userRef = doc(db, 'users', effectiveUserId);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load profile:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [effectiveUserId]);

  const updateProfile = useCallback(
    async (profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!effectiveUserId) return;
      try {
        setError(null);
        const userRef = doc(db, 'users', effectiveUserId);
        const existing = await getDoc(userRef);
        const now = Date.now();
        await setDoc(
          userRef,
          {
            ...profileData,
            id: effectiveUserId,
            createdAt: existing.exists() ? (existing.data().createdAt ?? now) : now,
            updatedAt: now,
          },
          { merge: true }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update profile';
        setError(msg);
        throw err;
      }
    },
    [effectiveUserId]
  );

  const [uploadingPicture, setUploadingPicture] = useState(false);

  // Uploads the given file to Cloudinary (unsigned upload preset) and
  // returns the resulting secure_url. Callers save that URL into the
  // Firestore users/{uid} doc's profilePicture field via updateProfile.
  const uploadProfilePicture = useCallback(async (file: File): Promise<string> => {
    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Cloudinary upload failed (${response.status}): ${text}`);
      }

      const data = await response.json();
      if (!data.secure_url) {
        throw new Error('Cloudinary response missing secure_url');
      }
      return data.secure_url as string;
    } finally {
      setUploadingPicture(false);
    }
  }, []);

  return { profile, loading, error, updateProfile, uploadProfilePicture, uploadingPicture };
};
