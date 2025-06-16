// Firebase Database Integration
// This file handles all Firebase operations for the Travel Split app

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDTF74fzf9ZE6Z9iDPTl1AO-Hz-SrDUlUI",
  authDomain: "travelsplit-app.firebaseapp.com",
  databaseURL: "https://travelsplit-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "travelsplit-app",
  storageBucket: "travelsplit-app.firebasestorage.app",
  messagingSenderId: "871968672880",
  appId: "1:871968672880:web:c3e2dda7ed2ee7d857b8b5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Firebase status indicator
let isOnline = false;
let syncStatus = 'offline';

// Update sync status in UI
function updateSyncStatus(status) {
    syncStatus = status;
    const badges = document.querySelectorAll('.firebase-badge');
    badges.forEach(badge => {
        badge.className = `firebase-badge ${status}`;
        switch(status) {
            case 'online':
                badge.textContent = '🟢 Синхронизировано';
                break;
            case 'syncing':
                badge.textContent = '🟡 Синхронизация...';
                break;
            case 'offline':
                badge.textContent = '🔴 Офлайн';
                break;
            case 'error':
                badge.textContent = '❌ Ошибка синхронизации';
                break;
        }
    });
}

// Check connection status
database.ref('.info/connected').on('value', (snapshot) => {
    isOnline = snapshot.val();
    if (isOnline) {
        updateSyncStatus('online');
        syncLocalDataToFirebase();
    } else {
        updateSyncStatus('offline');
    }
});

// Generate unique ID for trips
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Sync local data to Firebase when coming online
function syncLocalDataToFirebase() {
    const localTrips = JSON.parse(localStorage.getItem('trips') || '[]');

    localTrips.forEach(trip => {
        if (!trip.synced) {
            saveTrip(trip);
        }
    });
}

// Save trip to Firebase
function saveTrip(trip) {
    if (!isOnline) {
        // Save locally if offline
        trip.synced = false;
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        const existingIndex = trips.findIndex(t => t.id === trip.id);

        if (existingIndex >= 0) {
            trips[existingIndex] = trip;
        } else {
            trips.push(trip);
        }

        localStorage.setItem('trips', JSON.stringify(trips));
        return Promise.resolve(trip);
    }

    updateSyncStatus('syncing');

    return database.ref('trips/' + trip.id).set({
        ...trip,
        synced: true,
        lastModified: Date.now()
    }).then(() => {
        // Also save to localStorage for offline access
        trip.synced = true;
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        const existingIndex = trips.findIndex(t => t.id === trip.id);

        if (existingIndex >= 0) {
            trips[existingIndex] = trip;
        } else {
            trips.push(trip);
        }

        localStorage.setItem('trips', JSON.stringify(trips));
        updateSyncStatus('online');
        return trip;
    }).catch(error => {
        console.error('Error saving to Firebase:', error);
        updateSyncStatus('error');
        // Save locally as fallback
        trip.synced = false;
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        const existingIndex = trips.findIndex(t => t.id === trip.id);

        if (existingIndex >= 0) {
            trips[existingIndex] = trip;
        } else {
            trips.push(trip);
        }

        localStorage.setItem('trips', JSON.stringify(trips));
        throw error;
    });
}

// Load all trips
function loadTrips() {
    if (!isOnline) {
        // Load from localStorage if offline
        return Promise.resolve(JSON.parse(localStorage.getItem('trips') || '[]'));
    }

    updateSyncStatus('syncing');

    return database.ref('trips').once('value').then(snapshot => {
        const firebaseTrips = [];
        snapshot.forEach(childSnapshot => {
            firebaseTrips.push(childSnapshot.val());
        });

        // Merge with local data
        const localTrips = JSON.parse(localStorage.getItem('trips') || '[]');
        const mergedTrips = mergeTrips(localTrips, firebaseTrips);

        // Save merged data locally
        localStorage.setItem('trips', JSON.stringify(mergedTrips));
        updateSyncStatus('online');

        return mergedTrips;
    }).catch(error => {
        console.error('Error loading from Firebase:', error);
        updateSyncStatus('error');
        // Fallback to localStorage
        return JSON.parse(localStorage.getItem('trips') || '[]');
    });
}

// Merge local and Firebase trips
function mergeTrips(localTrips, firebaseTrips) {
    const merged = [...firebaseTrips];

    localTrips.forEach(localTrip => {
        const firebaseTrip = firebaseTrips.find(t => t.id === localTrip.id);

        if (!firebaseTrip) {
            // Local trip doesn't exist in Firebase, add it
            merged.push(localTrip);
        } else if (!localTrip.synced && localTrip.lastModified > firebaseTrip.lastModified) {
            // Local trip is newer, replace Firebase version
            const index = merged.findIndex(t => t.id === localTrip.id);
            merged[index] = localTrip;
        }
    });

    return merged;
}

// Load specific trip
function loadTrip(tripId) {
    if (!isOnline) {
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        return Promise.resolve(trips.find(t => t.id === tripId));
    }

    return database.ref('trips/' + tripId).once('value').then(snapshot => {
        const trip = snapshot.val();
        if (trip) {
            // Also save to localStorage
            const trips = JSON.parse(localStorage.getItem('trips') || '[]');
            const existingIndex = trips.findIndex(t => t.id === tripId);

            if (existingIndex >= 0) {
                trips[existingIndex] = trip;
            } else {
                trips.push(trip);
            }

            localStorage.setItem('trips', JSON.stringify(trips));
        }
        return trip;
    }).catch(error => {
        console.error('Error loading trip from Firebase:', error);
        // Fallback to localStorage
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        return trips.find(t => t.id === tripId);
    });
}

// Delete trip
function deleteTrip(tripId) {
    if (!isOnline) {
        // Delete locally if offline
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        const filteredTrips = trips.filter(t => t.id !== tripId);
        localStorage.setItem('trips', JSON.stringify(filteredTrips));
        return Promise.resolve();
    }

    updateSyncStatus('syncing');

    return database.ref('trips/' + tripId).remove().then(() => {
        // Also remove from localStorage
        const trips = JSON.parse(localStorage.getItem('trips') || '[]');
        const filteredTrips = trips.filter(t => t.id !== tripId);
        localStorage.setItem('trips', JSON.stringify(filteredTrips));
        updateSyncStatus('online');
    }).catch(error => {
        console.error('Error deleting from Firebase:', error);
        updateSyncStatus('error');
        throw error;
    });
}

// Listen for real-time updates
function listenForUpdates(callback) {
    if (!isOnline) return;

    database.ref('trips').on('value', (snapshot) => {
        const trips = [];
        snapshot.forEach(childSnapshot => {
            trips.push(childSnapshot.val());
        });

        // Update localStorage
        localStorage.setItem('trips', JSON.stringify(trips));

        if (callback) callback(trips);
    });
}

// Stop listening for updates
function stopListening() {
    database.ref('trips').off();
}

// Initialize Firebase status on page load
document.addEventListener('DOMContentLoaded', () => {
    updateSyncStatus('offline');
});

// Export functions for use in other files
window.TravelSplitDB = {
    saveTrip,
    loadTrips,
    loadTrip,
    deleteTrip,
    generateId,
    listenForUpdates,
    stopListening,
    updateSyncStatus
};
