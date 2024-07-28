const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());

// Fetch balance endpoint
app.get('/api/balance/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        const balance = snapshot.val() ? snapshot.val().balance : 0;
        res.json({ balance });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ message: 'Error fetching balance', error: error.message });
    }
});

// Update balance endpoint
app.post('/api/update-balance/:userId', async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body;
    try {
        await admin.database().ref(`users/${userId}`).set({ balance: amount });
        res.json({ message: 'Balance updated successfully' });
    } catch (error) {
        console.error('Error updating balance:', error);
        res.status(500).json({ message: 'Error updating balance', error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

