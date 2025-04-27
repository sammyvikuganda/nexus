const express = require('express');
const session = require('express-session');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

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

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET, // Secret key from environment variables
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
        maxAge: 60 * 60 * 1000 // Session expires after 1 hour
    }
}));

// Serve login form
app.get('/api/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>Login to Nexus</title>
        </head>
        <body>
            <div>
                <h1>Login to Nexus</h1>
                <form action="/api/login" method="POST">
                    <label for="phoneNumber">Phone Number:</label>
                    <input type="text" name="phoneNumber" id="phoneNumber" required>
                    <br>
                    <label for="pin">PIN:</label>
                    <input type="password" name="pin" id="pin" required>
                    <br>
                    <input type="submit" value="Login">
                </form>
            </div>
        </body>
        </html>
    `);
});

// Login user endpoint
app.post('/api/login', async (req, res) => {
    const { phoneNumber, pin } = req.body;

    try {
        const userSnapshot = await db.ref('users').orderByChild('phoneNumber').equalTo(phoneNumber).once('value');
        
        if (!userSnapshot.exists()) {
            return res.send(`
                <script>
                    alert('User not found. Please check your credentials.');
                    window.history.back();
                </script>
            `);
        }

        const user = userSnapshot.val();
        const userData = Object.values(user)[0];

        if (userData.pin !== pin) {
            return res.send(`
                <script>
                    alert('Incorrect PIN. Please try again.');
                    window.history.back();
                </script>
            `);
        }

        req.session.userId = userData.userId;

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).send('Error logging in user');
    }
});

// Serve the dashboard page
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/api/login');
    }

    try {
        const userSnapshot = await db.ref(`users/${req.session.userId}`).once('value');
        
        if (!userSnapshot.exists()) {
            return res.status(404).send('User not found');
        }

        const userData = userSnapshot.val();

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>Dashboard - Nexus</title>
            </head>
            <body>
                <h1>Welcome back, ${userData.firstName} ${userData.lastName}!</h1>
                <h2>Your Account Details</h2>
                <p>Balance: $${userData.balance}</p>
                <p>Crypto Balance: $${userData.cryptoBalance}</p>
                <p>Robot Credit: ${userData.robotCredit}</p>
                <p><a href="/profile">View Profile</a></p>
                <p><a href="/">Home</a> | <a href="/api/login">Logout</a></p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).send('Error fetching user data');
    }
});

// Serve the profile page
app.get('/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/api/login');
    }

    try {
        const userSnapshot = await db.ref(`users/${req.session.userId}`).once('value');
        
        if (!userSnapshot.exists()) {
            return res.status(404).send('User not found');
        }

        const userData = userSnapshot.val();

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>Profile - Nexus</title>
            </head>
            <body>
                <h1>Profile Details</h1>
                <p><strong>Phone Number:</strong> ${userData.phoneNumber}</p>
                <p><strong>Country:</strong> ${userData.country}</p>
                <p><strong>First Name:</strong> ${userData.firstName}</p>
                <p><strong>Last Name:</strong> ${userData.lastName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>KYC Status:</strong> ${userData.kyc}</p>
                <p><a href="/dashboard">Back to Dashboard</a> | <a href="/api/login">Logout</a></p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching user profile data:', error);
        res.status(500).send('Error fetching user profile data');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
