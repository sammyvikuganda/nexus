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

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { phoneNumber, pin } = req.body;

    try {
        const snapshot = await db.ref('users').orderByChild('phoneNumber').equalTo(phoneNumber).once('value');
        const users = snapshot.val();

        if (users) {
            let user = null;
            Object.keys(users).forEach(key => {
                if (users[key].pin === pin) {
                    user = { userId: key, ...users[key] };
                }
            });

            if (user) {
                res.json(user);
            } else {
                res.status(404).json({ message: 'Incorrect PIN or user not found' });
            }
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
    }
});

// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, firstName, lastName, dob, nin, email, sponsorCode, pin } = req.body;
    const userId = Date.now().toString(); // Generate a unique user ID

    try {
        await db.ref(`users/${userId}`).set({
            phoneNumber: phoneNumber,
            firstName: firstName,
            lastName: lastName,
            dob: dob,
            nin: nin,
            email: email,
            sponsorCode: sponsorCode,
            pin: pin,
            balance: 100 // Set initial balance to 100 or any other default value
        });
        res.json({ message: 'User registered successfully', userId: userId });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
});

// Update balance endpoint
app.patch('/api/update-balance', async (req, res) => {
    const { userId, amount } = req.body;

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            await userRef.update({ balance: amount }); // Set the balance directly from the request
            res.json({ message: 'Balance updated successfully', newBalance: amount });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating balance', error });
    }
});

// Fetch user details endpoint
app.get('/api/user-details/:userId', async (req, res) => {
    const { userId } = req.params;
    const { field } = req.query; // Accept a query parameter to specify which field to fetch

    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');
        
        if (snapshot.exists()) {
            const user = snapshot.val();
            
            if (field === 'balance') {
                res.json({ balance: user.balance });
            } else if (field === 'firstName') {
                res.json({ firstName: user.firstName });
            } else {
                res.status(400).json({ message: 'Invalid field requested' });
            }
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

