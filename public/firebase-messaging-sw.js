importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAlumyyH_QKhS86Xnr70MbdseqfauELVBw',
  authDomain: 'aletwende.firebaseapp.com',
  databaseURL: 'https://aletwende-default-rtdb.firebaseio.com',
  projectId: 'aletwende',
  storageBucket: 'aletwende.firebasestorage.app',
  messagingSenderId: '142861545293',
  appId: '1:142861545293:web:68937455173fb34ce19104',
  measurementId: 'G-VKEVKGT6QK',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const title = notification.title || 'Aletwende';
  self.registration.showNotification(title, {
    body: notification.body || '',
    icon: notification.icon || '/favicon.ico',
  });
});
