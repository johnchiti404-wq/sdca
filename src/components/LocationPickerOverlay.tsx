import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { reverseGeocode } from '../services/geoapifyService';
import { ConfirmLocationPanel } from './ConfirmLocationPanel';

export type LocationCoordinate = { lat: number; lng: number };
export type LocationEditMode = 'pickup' | 'destination';

interface LocationPickerOverlayProps {
  mode: LocationEditMode;
  initialCoordinate: LocationCoordinate;
  initialAddress: string;
  onConfirm: (coordinate: LocationCoordinate, address: string) => void;
  onCancel: () => void;
  onAddressChange?: (address: string) => void;
}

export function LocationPickerOverlay({ mode, initialCoordinate, initialAddress, onConfirm, onCancel, onAddressChange }: LocationPickerOverlayProps) {
  const [address, setAddress] = useState(initialAddress);
  const [coordinate, setCoordinate] = useState(initialCoordinate);
  const [isLoading, setIsLoading] = useState(false);
  const onAddressChangeRef = useRef(onAddressChange);

  useEffect(() => {
    onAddressChangeRef.current = onAddressChange;
  }, [onAddressChange]);

  useEffect(() => {
    setCoordinate(initialCoordinate);
  }, [initialCoordinate.lat, initialCoordinate.lng]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      let result = await reverseGeocode(initialCoordinate.lat, initialCoordinate.lng);
      if (!result) {
        result = await reverseGeocode(initialCoordinate.lat, initialCoordinate.lng);
      }
      if (!cancelled) {
        const nextAddress = result?.address || formatCoordinateAddress(initialCoordinate);
        setAddress(nextAddress);
        onAddressChangeRef.current?.(nextAddress);
        setIsLoading(false);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [initialCoordinate.lat, initialCoordinate.lng]);

  const label = mode === 'pickup' ? 'pickup' : 'destination';

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <div className="pointer-events-auto absolute left-4 right-4 top-4 flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-xl">
        <button aria-label="Cancel location edit" onClick={onCancel} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Adjust {label}</p>
          <p className="truncate text-sm font-medium text-gray-900">Move the map to choose a new {label}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full animate-in zoom-in-75 fade-in duration-300">
        <div className="relative flex flex-col items-center">
          <div className="flex size-12 items-center justify-center rounded-full border-4 border-white bg-[#5B2EFF] shadow-lg"><MapPin size={22} className="text-white" fill="currentColor" /></div>
          <div className="h-7 w-1 rounded-full bg-[#5B2EFF] shadow-sm" />
          <div className="size-2 rounded-full bg-[#5B2EFF]" />
        </div>
      </div>
      <ConfirmLocationPanel mode={mode} address={address} isLoading={isLoading} coordinate={coordinate} onConfirm={onConfirm} />
    </div>
  );
}

export function formatCoordinateAddress(coordinate: LocationCoordinate) {
  return `${coordinate.lat.toFixed(5)}, ${coordinate.lng.toFixed(5)}`;
}
