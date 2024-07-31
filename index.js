const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
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
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

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

// Helper function to check for existing user details
const checkIfExists = async (phoneNumber, email, nin) => {
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val();

    for (const userId in users) {
        const user = users[userId];
        if (user.phoneNumber === phoneNumber || user.email === email || user.nin === nin) {
            return true;
        }
    }
    return false;
};

// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, firstName, lastName, dob, nin, email, sponsorCode, pin } = req.body;

    try {
        // Check for existing user details
        const userExists = await checkIfExists(phoneNumber, email, nin);

        if (userExists) {
            return res.status(400).json({ message: 'User already exists with this phone number, email, or NIN' });
        }

        // Generate a unique 6-digit user ID
        const userId = Math.floor(100000 + Math.random() * 900000).toString();

        await db.ref(`users/${userId}`).set({
            phoneNumber: phoneNumber,
            firstName: firstName,
            lastName: lastName,
            dob: dob,
            nin: nin,
            email: email,
            sponsorCode: sponsorCode,
            pin: pin,
            balance: 0, // Set initial balance to 0
            kyc: 'Pending' // Set initial KYC status to Pending
        });

        res.json({ message: 'User registered successfully', userId: userId });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
});

// Update balance endpoint
app.patch('/api/update-balance', async (req, res) => {
    const { userId, balance } = req.body;

    if (!userId || balance === undefined) {
        return res.status(400).json({ message: 'User ID and balance are required' });
    }

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            await userRef.update({ balance: balance });
            res.json({ message: 'Balance updated successfully', newBalance: balance });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating balance:', error); // Log the error
        res.status(500).json({ message: 'Error updating balance', error: error.message });
    }
});

// Update user details endpoint
app.patch('/api/update-user', async (req, res) => {
    const { userId, phoneNumber, firstName, lastName, dob, nin, email, sponsorCode, pin, kyc } = req.body;

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            const updates = {};
            if (phoneNumber) updates.phoneNumber = phoneNumber;
            if (firstName) updates.firstName = firstName;
            if (lastName) updates.lastName = lastName;
            if (dob) updates.dob = dob;
            if (nin) updates.nin = nin;
            if (email) updates.email = email;
            if (sponsorCode) updates.sponsorCode = sponsorCode;
            if (pin) updates.pin = pin;
            if (kyc) updates.kyc = kyc;

            await userRef.update(updates);
            res.json({ message: 'User details updated successfully', updatedFields: updates });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating user details', error });
    }
});

// Fetch user details endpoint
app.get('/api/user-details/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');
        
        if (snapshot.exists()) {
            const user = snapshot.val();
            res.json({
                fullName: `${user.firstName} ${user.lastName}`,
                phoneNumber: user.phoneNumber,
                email: user.email,
                kyc: user.kyc
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details', error });
    }
});

// Fetch user first name endpoint
app.get('/api/user-first-name/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');
        
        if (snapshot.exists()) {
            const user = snapshot.val();
            res.json({
                firstName: user.firstName
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details', error });
    }
});

// Fetch user balance endpoint
app.get('/api/user-balance/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');
        
        if (snapshot.exists()) {
            const user = snapshot.val();
            res.json({
                balance: user.balance
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user balance', error });
    }
});

// Verify old PIN endpoint
app.post('/api/verify-pin', async (req, res) => {
    const { userId, pin } = req.body;

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
            const user = snapshot.val();
            if (user.pin === pin) {
                res.json({ valid: true });
            } else {
                res.json({ valid: false });
            }
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error verifying PIN', error });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
