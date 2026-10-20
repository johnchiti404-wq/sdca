import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { LocationCoordinate, LocationEditMode } from './LocationPickerOverlay';

interface ConfirmLocationPanelProps {
  mode: LocationEditMode;
  address: string;
  isLoading: boolean;
  onConfirm: (coordinate: LocationCoordinate, address: string) => void;
  coordinate: LocationCoordinate;
}

export function ConfirmLocationPanel({ mode, address, isLoading, onConfirm, coordinate }: ConfirmLocationPanelProps) {
  const label = mode === 'pickup' ? 'pickup' : 'destination';

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        {isLoading ? <Loader2 className="shrink-0 animate-spin text-[#5B2EFF]" /> : <Search className="shrink-0 text-[#5B2EFF]" />}
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="flex flex-col gap-2" aria-label="Finding address">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            </div>
          ) : (
            <p className="truncate text-sm font-medium text-gray-900">{address || 'Move the map to find an address'}</p>
          )}
        </div>
      </div>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5B2EFF] px-4 py-4 text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading || !address}
        onClick={() => onConfirm(coordinate, address)}
      >
        {isLoading && <Loader2 className="animate-spin" />}
        {isLoading ? 'Finding address…' : `Confirm ${label}`}
      </button>
    </div>
  );
}
