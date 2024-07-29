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

const db = admin.database();

app.use(cors());
app.use(express.json());

// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, firstName, lastName, dob, nin, email, sponsorCode } = req.body;
    const userId = Date.now().toString(); // Generate a unique user ID

    try {
        await db.ref(`users/${userId}`).set({
            phoneNumber: phoneNumber,
            firstName: firstName,
            lastName: lastName,
            dob: dob,
            nin: nin,
            email: email,
            sponsorCode: sponsorCode
        });
        res.json({ message: 'User registered successfully', userId: userId });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
});

// Update user details endpoint
app.post('/api/update-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { phoneNumber, firstName, lastName, dob, nin, email, sponsorCode } = req.body;

    try {
        await db.ref(`users/${userId}`).update({
            phoneNumber: phoneNumber,
            firstName: firstName,
            lastName: lastName,
            dob: dob,
            nin: nin,
            email: email,
            sponsorCode: sponsorCode
        });
        res.json({ message: 'User details updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user details', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
