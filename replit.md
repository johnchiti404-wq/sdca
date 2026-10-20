# Aletwende — E-Hailing App

A React + TypeScript + Vite mobile-style e-hailing app with ride-hailing, food delivery, and package/towing/truck delivery services, backed by Firebase (Firestore + Realtime Database + Auth).

## Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, Framer Motion
- **Map:** MapLibre GL (OpenStreetMap tiles — no API key required)
- **Backend:** Firebase (project: `aletwende`) — config is baked into `src/config/firebase.ts`
- **Address autocomplete:** Geoapify (key in `src/services/geoapifyService.ts`)

## How to run

The `Start application` workflow runs `npm run dev` on port 5000. Start it from the Workflows panel or restart it after any code changes.

## Project structure

```
src/
  pages/       — Route-level screens (Dashboard, YourRoute, SelectRide, ConfirmOrder, …)
  components/  — Reusable UI components (DraggablePanel, MapLibreMap, ErrorBoundary, …)
  contexts/    — React context providers (RideContext, LocationContext, FoodOrderSession, …)
  hooks/       — Custom hooks (useGeolocation, useFirebaseRide, useUserProfile, …)
  services/    — Firebase and Geoapify service helpers
  config/      — firebase.ts, api.ts
  utils/       — ETA calculation, helpers
```

## Known behaviour

- The map background shows as gray in the Replit preview because WebGL is not available in the sandboxed iframe. It renders correctly on a real device or desktop browser.
- Location is shown as "off" in the preview for the same reason; the app still works for navigation.

## User preferences

- Keep the existing project structure and Firebase/Vite stack.
