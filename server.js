require('dotenv').config();

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
    databaseURL: "https://records-1674c-default-rtdb.firebaseio.com",
});

// Middleware
app.use(cors());
app.use(express.json());

// Registration endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, firstName, lastName, dob, nin, email, sponsorCode } = req.body;

    console.log('Received registration request:', req.body);

    try {
        const userId = email;

        await admin.database().ref(`users/${userId}`).set({
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
        console.error('Error registering user:', error);

        res.status(500).json({ message: 'Error registering user', error });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
