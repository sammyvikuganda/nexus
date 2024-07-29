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

const db = admin.database();

app.use(cors());
app.use(express.json());

// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, phoneNumber, dob, nin, email, sponsorCode } = req.body;
    const userId = Date.now().toString(); // Generate a unique user ID

    try {
        await db.ref(`users/${userId}`).set({
            firstName,
            lastName,
            phoneNumber,
            dob,
            nin,
            email,
            sponsorCode,
        });
        res.json({ message: 'User registered successfully', userId });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
});

// Update user details endpoint
app.post('/api/update-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, phoneNumber, dob, nin, email, sponsorCode } = req.body;

    try {
        await db.ref(`users/${userId}`).update({
            firstName,
            lastName,
            phoneNumber,
            dob,
            nin,
            email,
            sponsorCode,
        });
        res.json({ message: 'User details updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user details', error });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { name, sponsorCode } = req.body;

    try {
        const snapshot = await db.ref('users').orderByChild('sponsorCode').equalTo(sponsorCode).once('value');
        const users = snapshot.val();

        if (users) {
            let user = null;
            Object.keys(users).forEach(key => {
                if (users[key].firstName === name || users[key].lastName === name) {
                    user = { userId: key, ...users[key] };
                }
            });

            if (user) {
                res.json(user);
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
