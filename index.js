const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const Redis = require('ioredis'); // Redis client
const connectRedis = require('connect-redis'); // connect-redis v4
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 3000;
require('dotenv').config(); // to load .env file

const app = express();


// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}


const db = admin.database();
const publicKey = process.env.TEZA_PUBLIC_KEY;
const secretKey = process.env.TEZA_SECRET_KEY;

// CORS and Body Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Redis connection setup
const redisClient = new Redis({
    host: process.env.REDIS_HOST, // your Upstash host
    port: 6379,
    password: process.env.REDIS_PASSWORD, // your Upstash password
    tls: {} // important for Upstash
});

// Session setup with Redis
const RedisStore = connectRedis(session); // Use directly as constructor for v4

app.use(session({
    store: new RedisStore({
        client: redisClient,
        ttl: 30 * 60
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 30 * 60 * 1000
    }
}));





// Function to generate a unique credit history ID with the format 'CREDITxxxxx'
const generateCreditId = async () => {
    // Generate a random number between 10000 and 99999
    const randomId = Math.floor(Math.random() * 90000) + 10000;
    const creditId = `CREDIT${randomId}`;

// Check if the credit ID already exists in the database
    const creditRef = db.ref('credit-history');
    const snapshot = await creditRef.orderByKey().equalTo(creditId).once('value');
    
    if (snapshot.exists()) {
        // If it exists, recursively generate a new one
        return generateCreditId();
    }

    return creditId;
};




// Function to generate a unique withdrawal history ID with the format 'WITHDRAWxxxxx'
const generateWithdrawalId = async () => {
    const randomId = Math.floor(Math.random() * 90000) + 10000;
    const withdrawalId = `WITHDRAW${randomId}`;

    // Check if the withdrawal ID already exists in the database
    const withdrawalRef = db.ref('withdrawal-history');
    const snapshot = await withdrawalRef.orderByKey().equalTo(withdrawalId).once('value');

if (snapshot.exists()) {
        // If it exists, recursively generate a new one
        return generateWithdrawalId();
    }

    return withdrawalId;
};



const currentMonth = new Date().toLocaleString('default', { month: 'long' });




// Helper function to check for existing user details, including device info
const checkIfExists = async (phoneNumber, email, nin, deviceDetails) => {
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val();

    let credentialsExist = false;
    let deviceExists = false;

    // Iterate through each user to check for conflicts
    for (const userId in users) {
        const user = users[userId];
        if (
            user.phoneNumber === phoneNumber || 
            user.email === email || 
            (nin && user.nin === nin)
        ) {
            credentialsExist = true;
        }
        if (deviceDetails && user.deviceDetails && user.deviceDetails.userAgent === deviceDetails.userAgent) {
            deviceExists = true;
        }
    }

    return { credentialsExist, deviceExists };
};





// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, country, firstName, lastName, dob, nin, email, password, pin, deviceDetails } = req.body;
    const sponsorId = req.query.sponsorid;

    // pin is required
    if (!pin) {
        return res.status(400).json({
            success: false,
            message: 'Pin is required'
        });
    }

    try {
        const { credentialsExist, deviceExists } = await checkIfExists(phoneNumber, email, nin, deviceDetails);

        if (credentialsExist && deviceExists) {
            return res.status(400).json({
                success: false,
                message: 'Credentials already registered with this device'
            });
        }

        if (credentialsExist) {
            return res.status(400).json({
                success: false,
                message: 'Credentials already exist'
            });
        }

        if (deviceExists) {
            return res.status(400).json({
                success: false,
                message: 'Device already registered'
            });
        }

        const userId = Math.floor(100000 + Math.random() * 900000).toString();

        if (sponsorId) {
            const sponsorRef = await db.ref(`users/${sponsorId}`).once('value');
            if (sponsorRef.exists()) {
                const sponsorData = sponsorRef.val();
                const newReferralCount = (sponsorData.referralCount || 0) + 1;

                await db.ref(`users/${sponsorId}`).update({
                    referralCount: newReferralCount
                });
            }
        }

        // Construct user data object
        const userData = {
            phoneNumber,
            country,
            firstName,
            lastName,
            nin: nin || null,
            email,
            pin,                   // pin is required, so always present
            balance: 0,
            cryptoBalance: 0,
            robotCredit: 0,
            incompleteOrders: 0,
            monthlyCommission: 0,
            kyc: 'Pending',
            registeredAt: Date.now(),
            paymentMethods: {
                "Airtel Money": "",
                "MTN Mobile Money": "",
                "Chipper Cash": "",
                "Bank Transfer": "",
                "Crypto Transfer": ""
            },
            deviceDetails: deviceDetails || null,
            sponsorId: sponsorId || null,
            referralCount: 0
        };

        // Add dob if provided
        if (dob) {
            userData.dob = dob;
        }

        // Add password only if provided (optional)
        if (password) {
            userData.password = password;
        }

        await db.ref(`users/${userId}`).set(userData);

        try {
            const secondaryResponse = await axios.post('https://nexus-webapp-jll2j2zj6-nexus-projects-af3f0529.vercel.app/api/create-user', {
                userId: userId,
            });

            if (secondaryResponse.data.userId) {
                return res.json({
                    success: true,
                    userId: userId,
                    firstName: firstName,
                    lastName: lastName
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Secondary database registration failed',
                    userId: userId
                });
            }
        } catch (secondaryError) {
            console.error('Secondary database error:', secondaryError);
            return res.status(500).json({
                success: false,
                message: 'Secondary database registration failed',
                userId: userId
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});




// New endpoint to get crypto balance
app.get('/api/user-crypto-balance/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const userRef = await db.ref(`users/${userId}`).once('value');
        if (!userRef.exists()) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = userRef.val();
        const cryptoBalance = userData.cryptoBalance !== undefined ? userData.cryptoBalance : null;

        return res.json({ success: true, userId, cryptoBalance });
    } catch (error) {
        console.error('Error fetching crypto balance:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});




// Endpoint to update server status
app.patch('/api/update-server-status', async (req, res) => {
  const { status } = req.body; // Expecting 'status' to be either 'busy' or 'available'

  if (!status || (status !== 'busy' && status !== 'available')) {
    return res.status(400).json({ message: 'Invalid status. Must be either "busy" or "available".' });
  }

  try {
    const serverStatusRef = db.ref('serverStatus');
    
    // Set the new status
    await serverStatusRef.set(status);

    return res.status(200).json({
      message: `Server status updated to ${status}`,
    });
  } catch (error) {
    console.error('Error updating server status:', error);
    return res.status(500).json({ message: 'Error updating server status', error: error.message });
  }
});





// Unified JPesa payment endpoint with dynamic description and transaction ID format
app.post('/api/payment', async (req, res) => {
  const { mobile, amount, reason, userId } = req.body;

  // Validate input fields
  if (!mobile || !amount || !reason || !userId) {
    return res.status(400).json({ message: 'Mobile number, amount, reason, and userId are required.' });
  }

  const JPESA_API_KEY = process.env.JPESA_API_KEY;
  const CALLBACK_URL = process.env.CALLBACK_URL;

  // Ensure JPESA API Key and Callback URL are present in environment variables
  if (!JPESA_API_KEY || !CALLBACK_URL) {
    return res.status(500).json({ message: 'JPesa API Key or Callback URL missing in environment variables.' });
  }

  // Generate a unique transaction ID
  const nxs = `NXN${Date.now()}`;

  let action, finalReason;
  let amountToSend;

  // Handle "Top Up" logic
  if (reason.toLowerCase() === 'top up') {
    action = 'credit';
    finalReason = 'Top Up';
    amountToSend = Math.ceil(amount / 0.97); // Round up for top-up
  } else if (reason.toLowerCase() === 'withdraw') {
    action = 'debit';
    finalReason = 'Withdraw';

    if (amount < 1000) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is 1000.' });
    }

    const snapshot = await db.ref(`users/${userId}/balance`).once('value');
    const currentBalance = snapshot.val();

    if (currentBalance === null || currentBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance for withdrawal.' });
    }

    amountToSend = amount - 2000;
    if (amountToSend <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 2000 to cover the withdrawal charge.' });
    }
  } else {
    return res.status(400).json({ message: 'Reason must be either "Top Up" or "Withdraw".' });
  }

  // Prepare the XML data for JPesa API request
  const DATA = `<?xml version="1.0" encoding="ISO-8859-1"?>
    <g7bill>
      <_key_>${JPESA_API_KEY}</_key_>
      <cmd>account</cmd>
      <action>${action}</action>
      <pt>mm</pt>
      <mobile>${mobile}</mobile>
      <amount>${amountToSend}</amount>
      <callback>${CALLBACK_URL}</callback>
      <tx>${nxs}</tx>
      <description>${finalReason}</description>
    </g7bill>`;

  try {
    const response = await axios.post('https://my.jpesa.com/api/', DATA, {
      headers: { 'Content-Type': 'text/xml' },
    });

    // If JPesa response is successful, proceed with balance deduction and transaction logging
    if (response.data.api_status === 'success') {
      const tid = response.data.tid;

      // Deduct balance only after successful JPesa response
      if (reason.toLowerCase() === 'withdraw') {
        await db.ref(`users/${userId}/balance`).transaction((bal) => {
          if (bal === null || bal < amount) return; // Protect against race conditions
          return bal - amount;
        });
      }

      // Prepare the transaction data
      const transactionData = {
        transactionId: tid,
        mobile,
        amount: parseFloat(amount),  // Log the real amount entered by the user (not adjusted)
        reason: finalReason,
        status: 'Pending',
        createdAt: Date.now(),
      };

      // Store the transaction in the database
      await db.ref(`users/${userId}/transactions/${nxs}`).set(transactionData);

      // Respond with success message
      return res.status(200).json({
        message: `${finalReason} request sent successfully!`,
        transaction_id: nxs,
        data: response.data,
      });
    } else {
      // If JPesa response is not success, respond with the error message only once
      return res.status(400).json({
        message: `Transaction failed: ${response.data.msg}`,
        data: response.data,
      });
    }
  } catch (error) {
    // Catch and log any error
    console.error(`Error processing ${reason} request to JPesa:`, error);
    return res.status(500).json({ message: `Error processing ${reason}`, error: error.message });
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





// Endpoint to update user's PIN or password with current credential verification

app.patch('/api/update-user', async (req, res) => {
    const { userId, currentPin, currentPassword, pin, password } = req.body;

    try {
        if (!userId || (!pin && !password)) {
            return res.status(400).json({ message: 'User ID and at least one of new PIN or password is required' });
        }

        if (!currentPin && !currentPassword) {
            return res.status(400).json({ message: 'Current PIN or current password is required for verification' });
        }

        const userRef = db.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');

        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userSnapshot.val();

        if (currentPin && currentPin !== userData.pin) {
            return res.status(401).json({ message: 'Incorrect current PIN' });
        }

        if (currentPassword && currentPassword !== userData.password) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        const updates = {};
        if (pin) updates.pin = pin;
        if (password) updates.password = password;

        await userRef.update(updates);

        return res.status(200).json({ message: 'User info updated successfully' });
    } catch (error) {
        console.error('Error updating user info:', error);
        return res.status(500).json({ message: 'Failed to update user info' });
    }
});






// Store or update investment
app.post('/api/storeInvestment', async (req, res) => {
    try {
        const { userId, amount, premium = 0 } = req.body;  // Default premium is 0 if not provided
        if (!userId || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const now = new Date();
        const nowISO = now.toISOString();
        const investmentRef = db.ref(`users/${userId}/investment`);
        const transactionsRef = db.ref(`users/${userId}/investment/transactions`);
        const balanceRef = db.ref(`users/${userId}/balance`);
        const snapshot = await investmentRef.once('value');
        const balanceSnap = await balanceRef.once('value');
        const currentBalance = balanceSnap.val() || 0;

        if (currentBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Deduct the investment amount from balance
        await balanceRef.set(currentBalance - amount);

        if (snapshot.exists()) {
            const existing = snapshot.val();
            const newAmount = existing.amount + amount;
            await investmentRef.update({
                amount: newAmount,
                lastUpdated: nowISO,
                premium,
            });
        } else {
            await investmentRef.set({
                amount,
                payout: 0,
                lastUpdated: nowISO,
                premium,
                startDate: nowISO.split('T')[0]
            });
        }

        // Log the investment transaction
        await transactionsRef.push({
            amount,
            time: nowISO,
            reason: 'Investment added'
        });

        res.status(200).json({ message: 'Investment stored/updated successfully' });
    } catch (error) {
        console.error('Error storing investment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});




// Fetch and update investment
app.get('/api/fetchInvestment/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const investmentRef = db.ref(`users/${userId}/investment`);
        const snapshot = await investmentRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ message: 'No investment found for this user' });
        }

        const investment = snapshot.val();
        const currentTime = new Date();
        let lastUpdated = new Date(investment.lastUpdated);
        const transactionsRef = db.ref(`users/${userId}/investment/transactions`);
        let totalPayout = investment.payout || 0;
        const premium = investment.premium || 0;  // Default premium is 0 if not found

        // Calculate how many full 24-hour periods have passed
        let payoutCount = 0;
        while ((currentTime - lastUpdated) >= 24 * 60 * 60 * 1000) {
            payoutCount++;
            lastUpdated = new Date(lastUpdated.getTime() + 24 * 60 * 60 * 1000);

            // If premium is 0, use 1% (0.01) for the daily income calculation
            const dailyIncome = parseFloat((investment.amount * (premium > 0 ? premium / 100 : 0.01)).toFixed(2));
            totalPayout = parseFloat((totalPayout + dailyIncome).toFixed(2));

            await transactionsRef.push({
                amount: dailyIncome,
                time: lastUpdated.toISOString(),
                reason: "Commission paid"
            });
        }

        // Only update if there was a payout
        if (payoutCount > 0) {
            await investmentRef.update({
                payout: totalPayout,
                lastUpdated: lastUpdated.toISOString()
            });
        }

        const txSnapshot = await transactionsRef.once('value');
        const txHistory = txSnapshot.exists() ? Object.values(txSnapshot.val()) : [];

        res.status(200).json({
            userId,
            amount: investment.amount,
            payout: totalPayout,
            startDate: investment.startDate,
            lastUpdated: investment.lastUpdated,  // Include lastUpdated
            premium,  // Include premium in the response
            transactions: txHistory
        });
    } catch (error) {
        console.error('Error fetching investment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



// Withdraw payout or capital
app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, amount, reason } = req.body;

        // Validate input
        if (!userId || !amount || !reason) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const userRef = db.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');

        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userSnapshot.val();
        const investment = userData.investment;

        if (!investment) {
            return res.status(404).json({ message: 'No investment found for this user' });
        }

        const { amount: currentInvestmentAmount, payout } = investment;
        let newAmount = currentInvestmentAmount;
        let newPayout = payout || 0;
        let updateTotalGained = false;

        // Process withdrawal based on reason
        if (reason === 'Withdraw profits') {
            if (amount > newPayout) {
                return res.status(400).json({ message: 'Insufficient profits for withdrawal' });
            }
            newPayout -= amount; // Deduct from payout
            updateTotalGained = true;
        } else if (reason === 'Withdraw capital') {
            if (amount > currentInvestmentAmount) {
                return res.status(400).json({ message: 'Insufficient capital for withdrawal' });
            }
            newAmount -= amount; // Deduct from capital
        } else {
            return res.status(400).json({ message: 'Invalid reason. Use "Withdraw profits" or "Withdraw capital"' });
        }

        const now = new Date().toISOString();
        const transactionsRef = db.ref(`users/${userId}/investment/transactions`);

        // Store the withdrawal transaction
        await transactionsRef.push({
            amount,
            time: now,
            reason,
        });

        // Update investment fields
        const updates = {};
        updates['/investment/amount'] = newAmount;
        updates['/investment/payout'] = newPayout;
        updates['/investment/lastUpdated'] = now;

        // Update balance
        const currentBalance = userData.balance || 0;
        const newBalance = currentBalance + amount;
        updates['/balance'] = newBalance;

        // Update totalGained only if withdrawing profits
        if (updateTotalGained) {
            const currentGained = userData.totalGained || 0;
            updates['/totalGained'] = currentGained + amount;
        }

        await userRef.update(updates);

        res.status(200).json({ message: 'Withdrawal successful' });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});




// Login endpoint
app.post('/api/app-login', async (req, res) => {
    const { phoneNumber, pin } = req.body;

    if (!phoneNumber || !pin) {
        return res.status(400).json({
            success: false,
            message: 'Phone number and PIN are required'
        });
    }

    try {
        // Fetch all users and find one with matching phoneNumber and pin
        const usersSnapshot = await db.ref('users').once('value');
        const users = usersSnapshot.val();

        if (!users) {
            return res.status(404).json({
                success: false,
                message: 'No users found'
            });
        }

        const matchedUser = Object.entries(users).find(([userId, userData]) => {
            return userData.phoneNumber === phoneNumber && userData.pin === pin;
        });

        if (!matchedUser) {
            return res.status(401).json({
                success: false,
                message: 'Invalid phone number or PIN'
            });
        }

        const [userId, userData] = matchedUser;

        return res.json({
            success: true,
            message: 'Login successful',
            userId: userId,
            phoneNumber: userData.phoneNumber,
            pin: userData.pin,
            country: userData.country
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Login failed due to server error'
        });
    }
});




// ================== LOGIN ==================
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;

    try {
        // Check if login is a phone number or email
        let userSnapshot;
        if (login.includes('@')) {
            // Email login
            userSnapshot = await db
                .ref('users')
                .orderByChild('email')
                .equalTo(login)
                .once('value');
        } else {
            // Phone number login
            userSnapshot = await db
                .ref('users')
                .orderByChild('phoneNumber')
                .equalTo(login)
                .once('value');
        }

        if (!userSnapshot.exists()) {
            return res.status(400).send('User not found');
        }

        const users = userSnapshot.val();
        const userId = Object.keys(users)[0];
        const userData = users[userId];

        if (userData.password !== password) {
            return res.status(400).send('Incorrect password');
        }

        // Save only the userId in session
        req.session.userId = userId;

        return res.status(200).send('Login successful');
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Login error');
    }
});




// ================== LOGOUT ==================
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/api/login');
    });
});




app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        return res.json({ userId: req.session.userId });
    }
    res.status(401).json({ error: 'Not logged in' });
});





// Fetch user's phone number and name by userId
app.get('/api/user-details/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // Query the user data from the database
        const userRef = await db.ref(`users/${userId}`).once('value');

        // Check if the user exists
        if (!userRef.exists()) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get the user data from the snapshot
        const userData = userRef.val();

        // Return the response with the phone number and name
        return res.json({
            success: true,
            phoneNumber: userData.phoneNumber,
            firstName: userData.firstName,
            lastName: userData.lastName
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user details'
        });
    }
});





app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

