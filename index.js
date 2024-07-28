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
    databaseURL: "https://metal-pay-55c31-default-rtdb.firebaseio.com",
});

const db = admin.database();

app.use(cors());
app.use(express.json());

// Fetch balance endpoint
app.get('/api/balance/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await db.ref(`users/${userId}/balance`).once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ balance: snapshot.val() });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching balance', error });
    }
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, firstName, lastName, dob, nin, email, sponsorCode } = req.body;
    try {
        // Generate a unique user ID or use a suitable method for ID generation
        const userId = email; // For simplicity, using email as user ID

        await db.ref(`users/${userId}`).set({
            phoneNumber,
            firstName,
            lastName,
            dob,
            nin,
            email,
            sponsorCode
        });

        res.json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

