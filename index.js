import firebase from 'firebase/app';
import 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Reference to the database
const database = firebase.database();

// Handle form submission
document.getElementById('registration-form').addEventListener('submit', (event) => {
  event.preventDefault(); // Prevent the default form submission

  // Get form values
  const firstName = document.getElementById('first-name').value;
  const lastName = document.getElementById('last-name').value;
  const phoneNumber = document.getElementById('phone-number').value;

  // Generate a unique user ID (e.g., using timestamp or UUID)
  const userId = Date.now().toString();

  // Save user details to Firebase Realtime Database
  database.ref(`users/${userId}`).set({
    phoneNumber: phoneNumber,
    firstName: firstName,
    lastName: lastName
  })
  .then(() => {
    alert('User registered successfully!');
    // Clear form fields
    document.getElementById('registration-form').reset();
  })
  .catch((error) => {
    console.error('Error registering user:', error);
    alert('Error registering user. Please try again.');
  });
});
