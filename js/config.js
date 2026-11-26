// ============================================================
// GENERATIONS — Firebase configuration
// ------------------------------------------------------------
// Paste your Firebase web app config below (Firebase console →
// Project settings → Your apps → Web app → "Config").
//
// Connected to the Firebase project "generations-game" (Nov 2026).
// Add ?demo to any page URL to force LOCAL DEMO MODE for testing.
// While apiKey is empty, the game runs in LOCAL DEMO MODE:
// host + players work across tabs/windows of ONE browser on
// ONE computer (great for testing). Fill this in to let family
// phones join from anywhere.
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyAEYnIGNwFmgRiamAZFKO6y26GSEl6Tb6E",
  authDomain: "generations-game.firebaseapp.com",
  databaseURL: "https://generations-game-default-rtdb.firebaseio.com",
  projectId: "generations-game",
  storageBucket: "generations-game.firebasestorage.app",
  messagingSenderId: "1095438385024",
  appId: "1:1095438385024:web:b9e4e2e50df3ace5e38b65"
};

export const USE_FIREBASE = !!(firebaseConfig.apiKey && firebaseConfig.databaseURL) && !/[?&]demo\b/.test(location.search);

// Video calls: STUN finds a direct path between devices (works for most home Wi-Fi).
// For family on strict networks (some offices, hotels, cell carriers) add a TURN relay here, e.g.
// { urls: 'turn:YOUR-TURN-HOST:3478', username: '…', credential: '…' }  (metered.ca has a free tier)
export const iceServers = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];
