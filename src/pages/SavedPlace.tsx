import React, { useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { searchAddresses, GeoapifyAddress, RECENT_ADDRESSES_UPDATED_EVENT } from '../services/geoapifyService';
import { useGeolocation } from '../hooks/useGeolocation';
import { SavedPlace, SavedPlaces } from '../types';

export const SavedPlacePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { latitude, longitude } = useGeolocation();
  const state = (location.state || {}) as { mode?: 'home' | 'work' | 'custom'; place?: SavedPlace; savedPlaces?: SavedPlaces };
  const mode = state.mode || 'custom';
  const existing = state.place;
  const [title, setTitle] = useState(existing?.title || (mode === 'home' ? 'Home' : mode === 'work' ? 'Work' : ''));
  const [address, setAddress] = useState(existing?.address || '');
  const [coords, setCoords] = useState(existing ? { lat: existing.lat, lng: existing.lng } : null);
  const [suggestions, setSuggestions] = useState<GeoapifyAddress[]>([]);
  const [saving, setSaving] = useState(false);
  const canSave = Boolean(address && coords && (mode !== 'custom' || title.trim()));

  const heading = useMemo(() => mode === 'home' ? 'Home' : mode === 'work' ? 'Work' : existing ? 'Edit place' : 'Add a place', [mode, existing]);
  const search = async (value: string) => {
    setAddress(value);
    setCoords(null);
    if (value.trim().length < 2) { setSuggestions([]); return; }
    setSuggestions(await searchAddresses(value, latitude != null && longitude != null ? { lat: latitude, lng: longitude } : undefined));
  };
  const choose = (result: GeoapifyAddress) => { setAddress(result.address); setCoords(result.coords); setSuggestions([]); };
  const save = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !coords || !canSave) return;
    setSaving(true);
    try {
      const current = state.savedPlaces || { custom: [] };
      const place: SavedPlace = { id: existing?.id || `${mode}-${Date.now()}`, title: mode === 'custom' ? title.trim() : mode === 'home' ? 'Home' : 'Work', address, ...coords };
      const next: SavedPlaces = { ...current, custom: current.custom || [] };
      if (mode === 'home' || mode === 'work') next[mode] = place;
      else next.custom = existing?.id ? next.custom.map(item => item.id === existing.id ? place : item) : [...next.custom, place];
      await setDoc(doc(db, 'users', uid), { savedPlaces: next, updatedAt: Date.now() }, { merge: true });
      window.dispatchEvent(new Event(RECENT_ADDRESSES_UPDATED_EVENT));
      navigate('/account');
    } finally { setSaving(false); }
  };
  const remove = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !existing) return;
    const current = state.savedPlaces || { custom: [] };
    const next: SavedPlaces = { ...current, custom: current.custom || [] };
    if (mode === 'custom') next.custom = next.custom.filter(item => item.id !== existing.id);
    else delete next[mode];
    await setDoc(doc(db, 'users', uid), { savedPlaces: next, updatedAt: Date.now() }, { merge: true });
    window.dispatchEvent(new Event(RECENT_ADDRESSES_UPDATED_EVENT));
    navigate('/account');
  };
  return <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-6 text-gray-900 dark:text-white">
    <header className="flex items-center gap-3 mb-8"><button aria-label="Back" onClick={() => navigate(-1)}><ArrowLeft /></button><h1 className="text-2xl font-semibold">{heading}</h1></header>
    <div className="space-y-5">
      {mode === 'custom' && <label className="block"><span className="text-sm font-medium">Place name</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Gym" className="mt-2 w-full rounded-xl border p-4 bg-white dark:bg-gray-900" /></label>}
      <label className="block relative"><span className="text-sm font-medium">Address</span><div className="relative"><MapPin className="absolute left-4 top-4 text-gray-400" size={20} /><input value={address} onChange={e => void search(e.target.value)} placeholder="Search for an address" className="mt-2 w-full rounded-xl border p-4 pl-11 bg-white dark:bg-gray-900" /></div>
        {suggestions.length > 0 && <div className="absolute z-10 mt-1 w-[calc(100%-2rem)] rounded-xl bg-white dark:bg-gray-900 shadow-lg overflow-hidden">{suggestions.map(item => <button type="button" key={item.id} onClick={() => choose(item)} className="block w-full p-3 text-left border-b last:border-0"><p className="font-medium">{item.address}</p><p className="text-sm text-gray-500">{item.description}</p></button>)}</div>}
      </label>
      <button disabled={!canSave || saving} onClick={() => void save()} className="w-full rounded-xl bg-[#5B2EFF] py-4 font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Done'}</button>
      {existing && <button onClick={() => void remove()} className="w-full flex items-center justify-center gap-2 py-3 text-red-600"><Trash2 size={18} />Delete place</button>}
    </div>
  </main>;
};
export default SavedPlacePage;
