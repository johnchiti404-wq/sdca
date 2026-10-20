import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Pencil, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { useUserProfile } from '../hooks/useUserProfile';

type EditableField = 'name' | 'phone' | 'email';

interface FieldRowProps {
  label: string;
  value: string;
  placeholder: string;
  editing: boolean;
  editValue: string;
  saving: boolean;
  inputType?: string;
  onEditValueChange: (value: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

// Always shows the current value as plain text first — editing is an
// explicit switch triggered by the pencil icon, never a prerequisite to
// seeing the value.
const FieldRow: React.FC<FieldRowProps> = ({
  label,
  value,
  placeholder,
  editing,
  editValue,
  saving,
  inputType = 'text',
  onEditValueChange,
  onStartEdit,
  onCancel,
  onSave,
}) => (
  <div className="py-4 border-b border-gray-100 last:border-0">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      {!editing && (
        <button
          onClick={onStartEdit}
          aria-label={`Edit ${label}`}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#5B2EFF] hover:bg-purple-50 transition-colors"
        >
          <Pencil size={15} />
        </button>
      )}
    </div>

    {editing ? (
      <div className="mt-2 flex items-center gap-2">
        <input
          type={inputType}
          value={editValue}
          onChange={e => onEditValueChange(e.target.value)}
          autoFocus
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF]"
          placeholder={placeholder}
        />
        <button
          onClick={onSave}
          disabled={saving}
          aria-label="Save"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#5B2EFF] text-white disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500"
        >
          <X size={16} />
        </button>
      </div>
    ) : (
      <p className="mt-1 text-base text-gray-900 dark:text-white">{value || <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>}</p>
    )}
  </div>
);

export const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const { profile, updateProfile, uploadProfilePicture } = useUserProfile(userId);

  const [editField, setEditField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const startEdit = (field: EditableField) => {
    setEditField(field);
    setEditValue(profile?.[field] || '');
    setSaveError('');
  };

  const cancelEdit = () => {
    setEditField(null);
    setSaveError('');
  };

  const handleSave = async () => {
    if (!editField || !userId) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile({
        name: editField === 'name' ? editValue : profile?.name || '',
        phone: editField === 'phone' ? editValue : profile?.phone || '',
        email: editField === 'email' ? editValue : profile?.email || '',
        profilePicture: profile?.profilePicture,
      });
      setEditField(null);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    setPhotoError('');
    try {
      const secureUrl = await uploadProfilePicture(file);
      await updateProfile({
        name: profile?.name || '',
        phone: profile?.phone || '',
        email: profile?.email || '',
        profilePicture: secureUrl,
      });
    } catch (err) {
      console.error('Failed to upload profile picture:', err);
      setPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const initials = (profile?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-4">
        <button
          onClick={() => navigate('/account')}
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors mr-2"
        >
          <ArrowLeft size={22} className="text-gray-800 dark:text-gray-200" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden focus:outline-none"
          >
            {profile?.profilePicture ? (
              <img src={profile.profilePicture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <Camera size={28} />
                {initials && <span className="text-xs mt-1 font-semibold">{initials}</span>}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            )}
          </button>
          {/* Edit badge */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#5B2EFF] rounded-full flex items-center justify-center shadow-md"
          >
            <Camera size={14} className="text-white" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-8">
          Drivers can only see your photo during pickup
        </p>
        {photoError && (
          <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> {photoError}
          </p>
        )}
      </div>

      {/* Info fields — always visible, edit is an explicit switch */}
      <div className="px-4">
        <div className="bg-white dark:bg-gray-900">
          <FieldRow
            label="Name"
            value={profile?.name || ''}
            placeholder="Add your name"
            editing={editField === 'name'}
            editValue={editValue}
            saving={saving}
            onEditValueChange={setEditValue}
            onStartEdit={() => startEdit('name')}
            onCancel={cancelEdit}
            onSave={handleSave}
          />
          <FieldRow
            label="Phone number"
            value={profile?.phone || ''}
            placeholder="Add your phone number"
            editing={editField === 'phone'}
            editValue={editValue}
            saving={saving}
            inputType="tel"
            onEditValueChange={setEditValue}
            onStartEdit={() => startEdit('phone')}
            onCancel={cancelEdit}
            onSave={handleSave}
          />
          <FieldRow
            label="Email"
            value={profile?.email || ''}
            placeholder="Add your email"
            editing={editField === 'email'}
            editValue={editValue}
            saving={saving}
            inputType="email"
            onEditValueChange={setEditValue}
            onStartEdit={() => startEdit('email')}
            onCancel={cancelEdit}
            onSave={handleSave}
          />

          {saveError && (
            <p className="text-red-500 text-sm py-2 flex items-center gap-1">
              <AlertCircle size={14} /> {saveError}
            </p>
          )}

          {/* Identity — unrelated verification flow, unchanged */}
          <div className="py-4 border-b border-gray-100 last:border-0 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Identity</span>
              <p className="mt-1 text-sm text-gray-500">Not verified</p>
            </div>
            <button className="bg-[#5B2EFF] text-white text-sm font-semibold px-5 py-2 rounded-full">
              Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
