const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const app = express();

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

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session setup
if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not set in environment variables');
}

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true } // set to true only if using HTTPS
    maxAge: 60 * 60 * 1000
}));

// ================== REGISTER ==================
app.post('/api/register', async (req, res) => {
    const { phoneNumber, pin, firstName, lastName } = req.body;

    if (!phoneNumber || !pin || !firstName || !lastName) {
        return res.status(400).send('Missing fields');
    }

    try {
        const newUserRef = db.ref('users').push();
        const userId = newUserRef.key;

        await newUserRef.set({
            userId,
            phoneNumber,
            pin,
            firstName,
            lastName,
            balance: 0,
            cryptoBalance: 0,
            robotCredit: 0
        });

        res.send('User registered successfully');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Registration error');
    }
});

// ================== LOGIN ==================
app.post('/api/login', async (req, res) => {
    const { phoneNumber, pin } = req.body;

    const isFormRequest = req.headers['content-type']?.includes('application/x-www-form-urlencoded');

    try {
        const usersSnapshot = await db.ref('users').orderByChild('phoneNumber').equalTo(phoneNumber).once('value');

        if (!usersSnapshot.exists()) {
            if (isFormRequest) {
                return res.send(`
                    <script>
                        alert('User not found');
                        window.location.href='/api/login';
                    </script>
                `);
            }
            return res.status(400).send('User not found');
        }

        const users = usersSnapshot.val();
        const userId = Object.keys(users)[0];
        const userData = users[userId];

        if (userData.pin !== pin) {
            if (isFormRequest) {
                return res.send(`
                    <script>
                        alert('Incorrect PIN');
                        window.location.href='/api/login';
                    </script>
                `);
            }
            return res.status(400).send('Incorrect PIN');
        }

        // Save only the userId in session
        req.session.userId = userId;

        return res.redirect('/dashboard');

    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Login error');
    }
});

// ================== LOGIN PAGE ==================
app.get('/api/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title>Login</title>
        </head>
        <body>
            <h1>Login</h1>
            <form action="/api/login" method="POST">
                <input type="text" name="phoneNumber" placeholder="Phone Number" required />
                <input type="password" name="pin" placeholder="PIN" required maxlength="5"/>
                <button type="submit">Login</button>
            </form>
        </body>
        </html>
    `);
});

// ================== DASHBOARD ==================
// Serve the dashboard page
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) {
        // Redirect to login if the user is not authenticated
        return res.redirect('/api/login');
    }

    try {
        // Fetch user details from the database using user ID stored in session
        const userSnapshot = await db.ref(`users/${req.session.userId}`).once('value');
        
        if (!userSnapshot.exists()) {
            return res.status(404).send('User not found');
        }

        const userData = userSnapshot.val();

        // Render the dashboard page with user details
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
                
                <!-- Button to go to profile page -->
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


// ================== LOGOUT ==================
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/api/login');
    });
});









// Serve the profile page
app.get('/profile', async (req, res) => {
    if (!req.session.userId) {
        // Redirect to login if the user is not authenticated
        return res.redirect('/api/login');
    }

    try {
        // Fetch user details from the database using user ID stored in session
        const userSnapshot = await db.ref(`users/${req.session.userId}`).once('value');
        
        if (!userSnapshot.exists()) {
            return res.status(404).send('User not found');
        }

        const userData = userSnapshot.val();

        // Render the profile page with user details
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




// ================== SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
