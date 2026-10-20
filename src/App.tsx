import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './config/firebase';
import { reconcileRecentAddresses } from './services/geoapifyService';
import { SplashScreen } from './pages/SplashScreen';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { YourRoute } from './pages/YourRoute';
import { Rides } from './pages/Rides';
import { Account } from './pages/Account';
import { PersonalInfo } from './pages/PersonalInfo';
import { LoginSecurity } from './pages/LoginSecurity';
import { SavedPlacePage } from './pages/SavedPlace';
import { SelectRide } from './pages/SelectRide';
import { ConfirmOrder } from './pages/ConfirmOrder';
import { WaitingForDriver } from './pages/WaitingForDriver';
import { DriverComing } from './pages/DriverComing';
import { ScheduleRide } from './pages/ScheduleRide';
import { ScheduleYourRoute } from './pages/ScheduleYourRoute';
import { ScheduleConfirm } from './pages/ScheduleConfirm';
import { WhatWentWrong } from './pages/WhatWentWrong';
import { AletwendeSend } from './pages/AletwendeSend';
import { Shop } from './pages/Shop';
import { OrderFoodies } from './pages/OrderFoodies';
import { OrderClothes } from './pages/OrderClothes';
import { OrderHardware } from './pages/OrderHardware';
import { OrderSoweto } from './pages/OrderSoweto';
import { OrderSmallShops } from './pages/OrderSmallShops';
import { FoodiesRoute } from './pages/FoodiesRoute';
import { FoodDelivery } from './pages/FoodDelivery';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { LiveTrackingPage } from './pages/LiveTrackingPage';
import { MessageProvider } from './contexts/MessageContext';
import { OrderSessionProvider } from './contexts/OrderSessionContext';
import { FoodOrderSessionProvider } from './contexts/FoodOrderSession';
import { GlobalCartProvider } from './contexts/GlobalCartContext';
import { PageTransition } from './components/PageTransition';
import { useUserProfile } from './hooks/useUserProfile';
import { useNotificationPermission } from './hooks/useNotificationPermission';
import { CallProvider } from './contexts/CallContext';
import { CallOverlay } from './components/CallOverlay';
import { MicPermissionPrompt } from './components/MicPermissionPrompt';
import { ActiveOrderProvider, ACTIVE_ORDER_POLICY, buildTrackingState, useActiveOrder } from './hooks/useActiveOrder';
import { ActiveOrderGate } from './components/ActiveOrderGate';
import { PendingRatingHost } from './components/PendingRatingHost';

interface AppState {
  selectedDestination: string;
  selectedPickup: string;
  selectedStops: string[];
  selectedCarType: string;
  selectedPrice: number;
  currentRideId: string | null;
}

function AppContent({ userId }: { userId: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    void reconcileRecentAddresses(userId);
  }, [userId]);
  const location = useLocation();
  const { profile } = useUserProfile(userId);
  const { order, orderId, isLoading: isActiveOrderLoading } = useActiveOrder();
  const [orderSplashExpired, setOrderSplashExpired] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setOrderSplashExpired(true), 2500);
    return () => window.clearTimeout(timeout);
  }, []);

  const [appState, setAppState] = useState<AppState>({
    selectedDestination: '',
    selectedPickup: 'Current Location',
    selectedStops: [],
    selectedCarType: '',
    selectedPrice: 0,
    currentRideId: null,
  });

  const trackingOrderId = orderId ?? appState.currentRideId;
  const [isPendingRatingOpen, setIsPendingRatingOpen] = useState(false);
  const [pushToast, setPushToast] = useState<{ title: string; body: string } | null>(null);

  const handleForegroundMessage = useCallback((title: string, body: string) => {
    setPushToast({ title, body });
    window.setTimeout(() => setPushToast(null), 5000);
  }, []);

  useNotificationPermission(userId, handleForegroundMessage);

  // Startup location permission, GPS detection, live position watching and
  // throttled reverse geocoding are now owned by the global LocationProvider
  // (wired in main.tsx). Pages read it via useGeolocation / useLocation.

  if (isActiveOrderLoading && !orderSplashExpired) {
    return <SplashScreen onComplete={() => undefined} />;
  }

  const redirectToActiveOrder = () => {
    if (!order || !orderId) return false;
    navigate(ACTIVE_ORDER_POLICY.routeForOrder(order), {
      replace: true,
      state: buildTrackingState(order, orderId),
    });
    return true;
  };

  const handleRouteComplete = (pickup: string, destination: string, stops: string[]) => {
    setAppState(prev => ({
      ...prev,
      selectedPickup: pickup,
      selectedDestination: destination,
      selectedStops: stops
    }));
  };

  const handleSearchSelect = (address: string) => {
    if (redirectToActiveOrder()) return;
    setAppState(prev => ({ ...prev, selectedDestination: address }));
    navigate('/select-ride');
  };

  const handleRideSelect = (carType: string, price: number) => {
    if (redirectToActiveOrder()) return;
    setAppState(prev => ({ ...prev, selectedCarType: carType, selectedPrice: price }));
    navigate('/confirm-order');
  };

  const handleConfirmOrder = () => {
    if (redirectToActiveOrder()) return;
    navigate('/waiting-for-driver');
  };

  const handleDriverFound = (rideId?: string) => {
    if (rideId) {
      setAppState(prev => ({ ...prev, currentRideId: rideId }));
    }
    if (!redirectToActiveOrder()) navigate('/driver-coming');
  };

  const handleRideCreated = (rideId: string) => {
    setAppState(prev => ({ ...prev, currentRideId: rideId }));
  };

  const handleBack = () => navigate(-1);

  const handleCancelToHome = () => {
    setAppState(prev => ({ ...prev, currentRideId: null }));
    navigate('/', { replace: true });
  };

  return (
    <GlobalCartProvider>
      <OrderSessionProvider>
        <FoodOrderSessionProvider>
          <MessageProvider userId={profile?.id || null} rideId={trackingOrderId}>
          <div className="app">
            <ActiveOrderGate isRatingModalOpen={isPendingRatingOpen} />
            <PendingRatingHost onOpenChange={setIsPendingRatingOpen} />
            {pushToast && (
              <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg" role="status">
                <p className="font-semibold">{pushToast.title}</p>
                {pushToast.body && <p className="mt-1 text-sm text-gray-200">{pushToast.body}</p>}
              </div>
            )}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <PageTransition>
                    <Dashboard
                      onSearchSelect={(address) => {
                        handleSearchSelect(address);
                      }}
                    />
                  </PageTransition>
                }
              />
              <Route
                path="/your-route"
                element={
                  <PageTransition>
                    <YourRoute onRouteComplete={handleRouteComplete} />
                  </PageTransition>
                }
              />
              <Route
                path="/rides"
                element={<PageTransition><Rides /></PageTransition>}
              />
              <Route
                path="/account"
                element={<PageTransition><Account /></PageTransition>}
              />
              <Route
                path="/personal-info"
                element={<PageTransition><PersonalInfo /></PageTransition>}
              />
  <Route
  path="/login-security"
  element={<PageTransition><LoginSecurity /></PageTransition>}
  />
  <Route
  path="/saved-place"
  element={<PageTransition><SavedPlacePage /></PageTransition>}
  />
              <Route
                path="/schedule-ride"
                element={<PageTransition><ScheduleRide /></PageTransition>}
              />
              <Route
                path="/schedule-your-route"
                element={<PageTransition><ScheduleYourRoute /></PageTransition>}
              />
              <Route
                path="/schedule-confirm"
                element={<PageTransition><ScheduleConfirm /></PageTransition>}
              />
              <Route
                path="/what-went-wrong"
                element={<PageTransition><WhatWentWrong /></PageTransition>}
              />
              <Route
                path="/aletwende-send"
                element={<PageTransition><AletwendeSend /></PageTransition>}
              />
              <Route
                path="/shop"
                element={<PageTransition><Shop /></PageTransition>}
              />
              <Route
                path="/order-foodies/:storeId"
                element={<PageTransition><OrderFoodies /></PageTransition>}
              />
              <Route
                path="/order-clothes/:storeId"
                element={<PageTransition><OrderClothes /></PageTransition>}
              />
              <Route
                path="/order-hardware/:storeId"
                element={<PageTransition><OrderHardware /></PageTransition>}
              />
              <Route
                path="/order-soweto/:storeId"
                element={<PageTransition><OrderSoweto /></PageTransition>}
              />
              <Route
                path="/order-small-shops/:storeId"
                element={<PageTransition><OrderSmallShops /></PageTransition>}
              />
              <Route
                path="/foodies-route"
                element={<PageTransition><FoodiesRoute /></PageTransition>}
              />
              <Route
                path="/food-delivery"
                element={<PageTransition><FoodDelivery /></PageTransition>}
              />
              <Route
                path="/order-tracking"
                element={<PageTransition><OrderTrackingPage /></PageTransition>}
              />
              <Route
                path="/live-tracking"
                element={<PageTransition><LiveTrackingPage /></PageTransition>}
              />
              <Route
                path="/select-ride"
                element={
                  <PageTransition>
                    <SelectRide
                      destination={appState.selectedDestination}
                      pickup={appState.selectedPickup}
                      stops={appState.selectedStops}
                      onBack={handleBack}
                      onSelectRide={handleRideSelect}
                    />
                  </PageTransition>
                }
              />
              <Route
                path="/confirm-order"
                element={
                  <PageTransition>
                    <ConfirmOrder
                      destination={appState.selectedDestination}
                      pickup={appState.selectedPickup}
                      stops={appState.selectedStops}
                      carType={appState.selectedCarType}
                      price={appState.selectedPrice}
                      onBack={handleBack}
                      onRideConfirmed={handleConfirmOrder}
                      onRideCreated={handleRideCreated}
                    />
                  </PageTransition>
                }
              />
              <Route
                path="/waiting-for-driver"
                element={
                  <PageTransition>
                    <WaitingForDriver
                      destination={appState.selectedDestination}
                      pickup={appState.selectedPickup}
                      stops={appState.selectedStops}
                      carType={appState.selectedCarType}
                      price={appState.selectedPrice}
                      currentRideId={trackingOrderId}
                      onCancel={handleCancelToHome}
                      onDriverFound={handleDriverFound}
                    />
                  </PageTransition>
                }
              />
              <Route
                path="/driver-coming"
                element={
                  <PageTransition>
                    <DriverComing
                      destination={appState.selectedDestination}
                      pickup={appState.selectedPickup}
                      stops={appState.selectedStops}
                      carType={appState.selectedCarType}
                      price={appState.selectedPrice}
                      currentRideId={trackingOrderId}
                      onBack={handleCancelToHome}
                    />
                  </PageTransition>
                }
              />
            </Routes>
          </AnimatePresence>

        </div>
          </MessageProvider>
        </FoodOrderSessionProvider>
      </OrderSessionProvider>
    </GlobalCartProvider>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authUser, setAuthUser] = useState<FirebaseUser | null | undefined>(undefined);
  // True from the moment signup creates the Firebase Auth account until the
  // Firestore profile-doc write is confirmed. See Login.tsx's handleSignup —
  // onAuthStateChanged fires as soon as the account exists, before that
  // write finishes, so we hold the authenticated view back until then.
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, setAuthUser);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Auth state still loading — invisible placeholder, no flash
  if (authUser === undefined) {
    return <div className="fixed inset-0 bg-white" />;
  }

  const showAuthedApp = Boolean(authUser) && !provisioning;

  // Authenticated vs unauthenticated views cross-fade so logout isn't jarring
  return (
    <AnimatePresence mode="wait">
      {showAuthedApp ? (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ minHeight: '100vh' }}
        >
          <Router>
            <ActiveOrderProvider uid={authUser!.uid}>
              <CallProvider>
                <AppContent userId={authUser!.uid} />
                <CallOverlay />
                <MicPermissionPrompt />
              </CallProvider>
            </ActiveOrderProvider>
          </Router>
        </motion.div>
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ minHeight: '100vh' }}
        >
          <Login
            onAuthSuccess={(user) => setAuthUser(user)}
            onProvisioningChange={setProvisioning}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
