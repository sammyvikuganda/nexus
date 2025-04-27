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
    secret: process.env.SESSION_SECRET, // only from env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set true if HTTPS
}));

// ================== REGISTER ==================
app.post('/api/register', async (req, res) => {
    const { phoneNumber, pin, firstName, lastName } = req.body;

    if (!phoneNumber || !pin || !firstName || !lastName) {
        return res.status(400).send('Missing fields');
    }

    try {
        const userId = phoneNumber;

        const userRef = db.ref('users/' + userId);
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
            return res.status(400).send('User already exists');
        }

        await userRef.set({
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
        const userRef = db.ref('users/' + phoneNumber);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
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

        const userData = snapshot.val();

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

        req.session.userId = userData.userId;

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
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/api/login');
    }

    try {
        const userRef = db.ref('users/' + req.session.userId);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).send('User not found');
        }

        const userData = snapshot.val();

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <title>Dashboard</title>
            </head>
            <body>
                <h1>Welcome back, ${userData.firstName} ${userData.lastName}!</h1>
                <p>Balance: $${userData.balance}</p>
                <p>Crypto Balance: $${userData.cryptoBalance}</p>
                <p>Robot Credit: ${userData.robotCredit}</p>
                <p><a href="/api/logout">Logout</a></p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).send('Dashboard error');
    }
});

// ================== LOGOUT ==================
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/api/login');
    });
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
