const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios'); // Import axios
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
        if (user.phoneNumber === phoneNumber || user.email === email || (nin && user.nin === nin)) {
            return true;
        }
    }
    return false;
};

// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, country, firstName, lastName, dob, nin, email, sponsorCode, pin } = req.body;

    try {
        // Check for existing user details
        const userExists = await checkIfExists(phoneNumber, email, nin);

        if (userExists) {
            return res.status(400).json({ message: 'Some of the credentials you provided are already registered. If you have registered previously, please log in to your account.' });
        }

        // Generate a unique 6-digit user ID
        const userId = Math.floor(100000 + Math.random() * 900000).toString();

        // Save user to the primary database (Firebase)
        await db.ref(`users/${userId}`).set({
            phoneNumber,
            country,
            firstName,
            lastName,
            dob,
            nin: nin || null,  // If NIN is not provided, set it as null
            email,
            sponsorCode,
            pin,
            balance: 0, // Set initial balance to 0
            cryptoBalance: 0, // Set initial crypto balance to 0
            robotCredit: 0,
            incompleteOrders: 0,
            monthlyCommission: 0, // Set initial monthly commission to 0
            kyc: 'Pending', // Set initial KYC status to Pending
            registeredAt: Date.now(), // Store the registration timestamp
            paymentMethods: {
                "Airtel Money": "",
                "MTN Mobile Money": "",
                "Chipper Cash": "",
                "Bank Transfer": "",
                "Crypto Transfer": ""
            } // Initialize paymentMethods with all options empty
        });

        // After creating the user in Firebase, send the userId to another database
        try {
            const secondaryResponse = await axios.post('https://upay-5iyy6inv7-sammyviks-projects.vercel.app/api/create-user', {
                userId: userId,
            });

            if (secondaryResponse.data.userId) {
                // If a sponsor code was provided, add the referral relationship
                if (sponsorCode) {
                    try {
                        const sponsorSnapshot = await db.ref(`users/${sponsorCode}`).once('value');
                        if (sponsorSnapshot.exists()) {
                            // Add referral relationship in the secondary database
                            const referralResponse = await axios.post('https://upay-5iyy6inv7-sammyviks-projects.vercel.app/api/add-referral', {
                                userId: sponsorCode, // Sponsor's user ID
                                referralId: userId, // Newly registered user's ID
                            });

                            if (referralResponse.data.success) {
                                return res.json({ 
                                    message: 'User registered successfully, replicated in secondary database, and referral added', 
                                    userId: userId 
                                });
                            } else {
                                console.error('Referral addition failed in secondary database.');
                                return res.json({ 
                                    message: 'User registered successfully, replicated in secondary database, but referral addition failed', 
                                    userId: userId 
                                });
                            }
                        } else {
                            console.error('Invalid sponsor code provided.');
                            return res.json({ 
                                message: 'User registered successfully, replicated in secondary database, but sponsor code invalid', 
                                userId: userId 
                            });
                        }
                    } catch (referralError) {
                        console.error('Error adding referral:', referralError);
                        return res.status(500).json({ 
                            message: 'User registered successfully, but referral addition failed', 
                            userId: userId 
                        });
                    }
                } else {
                    // No sponsor code was provided
                    return res.json({ 
                        message: 'User registered successfully and replicated in secondary database', 
                        userId: userId 
                    });
                }
            } else {
                // Handle failure from the secondary database
                return res.status(500).json({ 
                    message: 'User registered in the primary database, but failed in the secondary database', 
                    userId: userId 
                });
            }
        } catch (secondaryError) {
            console.error('Error creating user in secondary database:', secondaryError);
            return res.status(500).json({ 
                message: 'User registered in the primary database, but failed in the secondary database', 
                userId: userId 
            });
        }
    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ 
            message: 'Error registering user', 
            error 
        });
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
        const userSnapshot = await db.ref(`users/${userId}`).once('value');

        if (userSnapshot.exists()) {
            const user = userSnapshot.val();

            // Fetch transactions
            const transactionsSnapshot = await db.ref(`users/${userId}/transactions`).once('value');
            const transactions = transactionsSnapshot.val() || {};

            // Convert transactions object to an array for easier handling
            const transactionList = Object.keys(transactions).map(key => ({
                transactionId: key,
                ...transactions[key],
            }));

            res.json({
                fullName: `${user.firstName} ${user.lastName}`,
                phoneNumber: user.phoneNumber,
                incompleteOrders: user.incompleteOrders,
                robotCredit: user.robotCredit,
                country: user.country,
                email: user.email,
                kyc: user.kyc,
                sponsorCode: user.sponsorCode,
                registeredAt: user.registeredAt, // Include the registration date
                paymentMethods: user.paymentMethods || {
                    "Airtel Money": "",
                    "MTN Mobile Money": "",
                    "Chipper Cash": "",
                    "Bank Transfer": "",
                    "Crypto Transfer": ""
                },
                transactions: transactionList, // Include transaction list
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user details', error });
    }
});




// Update robot credit endpoint
app.post('/api/update-robot-credit', async (req, res) => {
    const { userId, newRobotCredit } = req.body;

    if (typeof newRobotCredit !== 'number') {
        return res.status(400).json({ message: 'The robot credit must be a number.' });
    }

    try {
        // Check if the user exists in the database
        const userSnapshot = await db.ref(`users/${userId}`).once('value');

        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the robotCredit field
        await db.ref(`users/${userId}`).update({
            robotCredit: newRobotCredit,
        });

        res.json({
            message: 'Robot credit updated successfully',
            userId: userId,
            robotCredit: newRobotCredit,
        });
    } catch (error) {
        console.error('Error updating robot credit:', error);
        res.status(500).json({
            message: 'Error updating robot credit',
            error,
        });
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


// Update crypto balance endpoint
app.patch('/api/update-crypto-balance', async (req, res) => {
    const { userId, amount, from, to, reason } = req.body; // Changed 'cryptoBalance' to 'amount'

    if (!userId || amount === undefined) {
        return res.status(400).json({ message: 'User ID and amount are required' });
    }

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
            const user = snapshot.val();
            
            // Calculate the new crypto balance by adding the specified amount
            const newCryptoBalance = (user.cryptoBalance || 0) + amount;

            // Update the crypto balance in the database
            await userRef.update({ cryptoBalance: newCryptoBalance });

            // Create a unique transaction ID with 'NXS' prefix
            const transactionId = `NXS${Date.now()}`;
            const transactionLogRef = db.ref(`users/${userId}/transactions/${transactionId}`);

            // Create the transaction log entry to reflect the updated amount
            const transactionData = {
                timestamp: Date.now(),
                amount: amount, // Log the updated amount
            };

            // Include optional fields if provided
            if (from) transactionData.from = from;
            if (to) transactionData.to = to;
            if (reason) transactionData.reason = reason;

            // Save the transaction log
            await transactionLogRef.set(transactionData);

            // Respond with a success message and the updated amount
            res.json({ message: 'Amount updated successfully', amount: amount });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating crypto balance', error: error.message });
    }
});





// Fetch user crypto balance endpoint
app.get('/api/user-crypto-balance/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');

        if (snapshot.exists()) {
            const user = snapshot.val();
            res.json({
                cryptoBalance: user.cryptoBalance
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user crypto balance', error });
    }
});




// Fetch user payment methods endpoint
app.get('/api/user-payment-methods/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const snapshot = await db.ref(`users/${userId}`).once('value');

        if (snapshot.exists()) {
            const user = snapshot.val();
            res.json({
                paymentMethods: user.paymentMethods || {
                    "Airtel Money": "",
                    "MTN Mobile Money": "",
                    "Chipper Cash": "",
                    "Bank Transfer": "",
                    "Crypto Transfer": ""
                }
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user payment methods', error });
    }
});



// Update payment methods endpoint
app.patch('/api/update-payment-methods', async (req, res) => {
    const { userId, paymentMethods } = req.body;

    // Ensure user ID and payment methods are provided
    if (!userId || typeof paymentMethods !== 'object') {
        return res.status(400).json({ message: 'User ID and payment methods object are required' });
    }

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
            // Merge existing payment methods with new ones
            const existingPaymentMethods = snapshot.val().paymentMethods || {};
            const updatedPaymentMethods = { ...existingPaymentMethods, ...paymentMethods };

            // Update the user's payment methods
            await userRef.update({ paymentMethods: updatedPaymentMethods });
            res.json({ message: 'Payment methods updated successfully', updatedPaymentMethods });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating payment methods', error: error.message });
    }
});










// Endpoint to return all countries, currency codes, and country codes
app.get('/api/countries', (req, res) => {
    const countriesData = [
    { "country": "Afghanistan", "currency_code": "AFN", "country_code": "+93", "flag": "🇦🇫" },
    { "country": "Albania", "currency_code": "ALL", "country_code": "+355", "flag": "🇦🇱" },
    { "country": "Algeria", "currency_code": "DZD", "country_code": "+213", "flag": "🇩🇿" },
    { "country": "Andorra", "currency_code": "EUR", "country_code": "+376", "flag": "🇦🇩" },
    { "country": "Angola", "currency_code": "AOA", "country_code": "+244", "flag": "🇦🇴" },
    { "country": "Argentina", "currency_code": "ARS", "country_code": "+54", "flag": "🇦🇷" },
    { "country": "Armenia", "currency_code": "AMD", "country_code": "+374", "flag": "🇦🇲" },
    { "country": "Australia", "currency_code": "AUD", "country_code": "+61", "flag": "🇦🇺" },
    { "country": "Austria", "currency_code": "EUR", "country_code": "+43", "flag": "🇦🇹" },
    { "country": "Azerbaijan", "currency_code": "AZN", "country_code": "+994", "flag": "🇦🇿" },
    { "country": "Bahamas", "currency_code": "BSD", "country_code": "+1-242", "flag": "🇧🇸" },
    { "country": "Bahrain", "currency_code": "BHD", "country_code": "+973", "flag": "🇧🇭" },
    { "country": "Bangladesh", "currency_code": "BDT", "country_code": "+880", "flag": "🇧🇩" },
    { "country": "Barbados", "currency_code": "BBD", "country_code": "+1-246", "flag": "🇧🇧" },
    { "country": "Belarus", "currency_code": "BYN", "country_code": "+375", "flag": "🇧🇾" },
    { "country": "Belgium", "currency_code": "EUR", "country_code": "+32", "flag": "🇧🇪" },
    { "country": "Belize", "currency_code": "BZD", "country_code": "+501", "flag": "🇧🇿" },
    { "country": "Benin", "currency_code": "XOF", "country_code": "+229", "flag": "🇧🇯" },
    { "country": "Bhutan", "currency_code": "BTN", "country_code": "+975", "flag": "🇧🇹" },
    { "country": "Bolivia", "currency_code": "BOB", "country_code": "+591", "flag": "🇧🇴" },
    { "country": "Bosnia and Herzegovina", "currency_code": "BAM", "country_code": "+387", "flag": "🇧🇦" },
    { "country": "Botswana", "currency_code": "BWP", "country_code": "+267", "flag": "🇧🇼" },
    { "country": "Brazil", "currency_code": "BRL", "country_code": "+55", "flag": "🇧🇷" },
    { "country": "Brunei", "currency_code": "BND", "country_code": "+673", "flag": "🇧🇳" },
    { "country": "Bulgaria", "currency_code": "BGN", "country_code": "+359", "flag": "🇧🇬" },
    { "country": "Burkina Faso", "currency_code": "XOF", "country_code": "+226", "flag": "🇧🇫" },
    { "country": "Burundi", "currency_code": "BIF", "country_code": "+257", "flag": "🇧🇮" },
    { "country": "Cabo Verde", "currency_code": "CVE", "country_code": "+238", "flag": "🇨🇻" },
    { "country": "Cambodia", "currency_code": "KHR", "country_code": "+855", "flag": "🇰🇭" },
    { "country": "Cameroon", "currency_code": "XAF", "country_code": "+237", "flag": "🇨🇲" },
    { "country": "Canada", "currency_code": "CAD", "country_code": "+1", "flag": "🇨🇦" },
    { "country": "Central African Republic", "currency_code": "CAF", "country_code": "+236", "flag": "🇨🇫" },
    { "country": "Chad", "currency_code": "CAF", "country_code": "+235", "flag": "🇹🇩" },
    { "country": "Chile", "currency_code": "CLP", "country_code": "+56", "flag": "🇨🇱" },
    { "country": "China", "currency_code": "CNY", "country_code": "+86", "flag": "🇨🇳" },
    { "country": "Colombia", "currency_code": "COP", "country_code": "+57", "flag": "🇨🇴" },
    { "country": "Comoros", "currency_code": "KMF", "country_code": "+269", "flag": "🇰🇲" },
    { "country": "Congo (Congo-Brazzaville)", "currency_code": "XAF", "country_code": "+242", "flag": "🇨🇬" },
    { "country": "Congo (Democratic Republic)", "currency_code": "CDF", "country_code": "+243", "flag": "🇨🇩" },
    { "country": "Costa Rica", "currency_code": "CRC", "country_code": "+506", "flag": "🇨🇷" },
    { "country": "Croatia", "currency_code": "HRK", "country_code": "+385", "flag": "🇭🇷" },
    { "country": "Cuba", "currency_code": "CUP", "country_code": "+53", "flag": "🇨🇺" },
    { "country": "Cyprus", "currency_code": "EUR", "country_code": "+357", "flag": "🇨🇾" },
    { "country": "Czech Republic", "currency_code": "CZK", "country_code": "+420", "flag": "🇨🇿" },
    { "country": "Denmark", "currency_code": "DKK", "country_code": "+45", "flag": "🇩🇰" },
    { "country": "Djibouti", "currency_code": "DJF", "country_code": "+253", "flag": "🇩🇯" },
    { "country": "Dominica", "currency_code": "XCD", "country_code": "+1-767", "flag": "🇩🇲" },
    { "country": "Dominican Republic", "currency_code": "DOP", "country_code": "+1-809", "flag": "🇩🇴" },
    { "country": "East Timor (Timor-Leste)", "currency_code": "USD", "country_code": "+670", "flag": "🇹🇱" },
    { "country": "Ecuador", "currency_code": "USD", "country_code": "+593", "flag": "🇪🇨" },
    { "country": "Egypt", "currency_code": "EGP", "country_code": "+20", "flag": "🇪🇬" },
    { "country": "El Salvador", "currency_code": "USD", "country_code": "+503", "flag": "🇸🇻" },
    { "country": "Equatorial Guinea", "currency_code": "CAF", "country_code": "+240", "flag": "🇬🇶" },
    { "country": "Eritrea", "currency_code": "ERN", "country_code": "+291", "flag": "🇪🇷" },
    { "country": "Estonia", "currency_code": "EUR", "country_code": "+372", "flag": "🇪🇪" },
    { "country": "Eswatini", "currency_code": "SZL", "country_code": "+268", "flag": "🇸🇿" },
    { "country": "Ethiopia", "currency_code": "ETB", "country_code": "+251", "flag": "🇪🇹" },
    { "country": "Fiji", "currency_code": "FJD", "country_code": "+679", "flag": "🇫🇯" },
    { "country": "Finland", "currency_code": "EUR", "country_code": "+358", "flag": "🇫🇮" },
    { "country": "France", "currency_code": "EUR", "country_code": "+33", "flag": "🇫🇷" },
    { "country": "Gabon", "currency_code": "CAF", "country_code": "+241", "flag": "🇬🇦" },
    { "country": "Gambia", "currency_code": "GMD", "country_code": "+220", "flag": "🇬🇲" },
    { "country": "Georgia", "currency_code": "GEL", "country_code": "+995", "flag": "🇬🇪" },
    { "country": "Germany", "currency_code": "EUR", "country_code": "+49", "flag": "🇩🇪" },
    { "country": "Ghana", "currency_code": "GHS", "country_code": "+233", "flag": "🇬🇭" },
    { "country": "Greece", "currency_code": "EUR", "country_code": "+30", "flag": "🇬🇷" },
    { "country": "Grenada", "currency_code": "XCD", "country_code": "+1-473", "flag": "🇬🇩" },
    { "country": "Guatemala", "currency_code": "GTQ", "country_code": "+502", "flag": "🇬🇹" },
    { "country": "Guinea", "currency_code": "GNF", "country_code": "+224", "flag": "🇬🇳" },
    { "country": "Guinea-Bissau", "currency_code": "CFA", "country_code": "+245", "flag": "🇬🇼" },
    { "country": "Guyana", "currency_code": "GYD", "country_code": "+592", "flag": "🇬🇾" },
    { "country": "Haiti", "currency_code": "HTG", "country_code": "+509", "flag": "🇭🇹" },
    { "country": "Honduras", "currency_code": "HNL", "country_code": "+504", "flag": "🇭🇳" },
    { "country": "Hungary", "currency_code": "HUF", "country_code": "+36", "flag": "🇭🇺" },
    { "country": "Iceland", "currency_code": "ISK", "country_code": "+354", "flag": "🇮🇸" },
    { "country": "India", "currency_code": "INR", "country_code": "+91", "flag": "🇮🇳" },
    { "country": "Indonesia", "currency_code": "IDR", "country_code": "+62", "flag": "🇮🇩" },
    { "country": "Iran", "currency_code": "IRR", "country_code": "+98", "flag": "🇮🇷" },
    { "country": "Iraq", "currency_code": "IQD", "country_code": "+964", "flag": "🇮🇶" },
    { "country": "Ireland", "currency_code": "EUR", "country_code": "+353", "flag": "🇮🇪" },
    { "country": "Israel", "currency_code": "ILS", "country_code": "+972", "flag": "🇮🇱" },
    { "country": "Italy", "currency_code": "EUR", "country_code": "+39", "flag": "🇮🇹" },
    { "country": "Jamaica", "currency_code": "JMD", "country_code": "+1-876", "flag": "🇯🇲" },
    { "country": "Japan", "currency_code": "JPY", "country_code": "+81", "flag": "🇯🇵" },

    { "country": "Jordan", "currency_code": "JOD", "country_code": "+962", "flag": "🇯🇴" },
    { "country": "Kazakhstan", "currency_code": "KZT", "country_code": "+7", "flag": "🇰🇿" },
    { "country": "Kenya", "currency_code": "KES", "country_code": "+254", "flag": "🇰🇪" },
    { "country": "Kiribati", "currency_code": "AUD", "country_code": "+686", "flag": "🇰🇮" },
    { "country": "Korea (North)", "currency_code": "KPW", "country_code": "+850", "flag": "🇰🇵" },
    { "country": "Korea (South)", "currency_code": "KRW", "country_code": "+82", "flag": "🇰🇷" },
    { "country": "Kuwait", "currency_code": "KWD", "country_code": "+965", "flag": "🇰🇼" },
    { "country": "Kyrgyzstan", "currency_code": "KGS", "country_code": "+996", "flag": "🇰🇬" },
    { "country": "Laos", "currency_code": "LAK", "country_code": "+856", "flag": "🇱🇦" },
    { "country": "Latvia", "currency_code": "LVL", "country_code": "+371", "flag": "🇱🇻" },
    { "country": "Lebanon", "currency_code": "LBP", "country_code": "+961", "flag": "🇱🇧" },
    { "country": "Lesotho", "currency_code": "LSL", "country_code": "+266", "flag": "🇱🇸" },
    { "country": "Liberia", "currency_code": "LRD", "country_code": "+231", "flag": "🇱🇷" },
    { "country": "Libya", "currency_code": "LYD", "country_code": "+218", "flag": "🇱🇾" },
    { "country": "Liechtenstein", "currency_code": "CHF", "country_code": "+423", "flag": "🇱🇮" },
    { "country": "Lithuania", "currency_code": "EUR", "country_code": "+370", "flag": "🇱🇹" },
    { "country": "Luxembourg", "currency_code": "EUR", "country_code": "+352", "flag": "🇱🇺" },
    { "country": "Madagascar", "currency_code": "MGA", "country_code": "+261", "flag": "🇲🇬" },
    { "country": "Malawi", "currency_code": "MWK", "country_code": "+265", "flag": "🇲🇼" },
    { "country": "Malaysia", "currency_code": "MYR", "country_code": "+60", "flag": "🇲🇾" },
    { "country": "Maldives", "currency_code": "MVR", "country_code": "+960", "flag": "🇲🇻" },
    { "country": "Mali", "currency_code": "CFA", "country_code": "+223", "flag": "🇲🇱" },
    { "country": "Malta", "currency_code": "EUR", "country_code": "+356", "flag": "🇲🇹" },
    { "country": "Marshall Islands", "currency_code": "USD", "country_code": "+692", "flag": "🇲🇭" },
    { "country": "Mauritania", "currency_code": "MRO", "country_code": "+222", "flag": "🇲🇷" },
    { "country": "Mauritius", "currency_code": "MUR", "country_code": "+230", "flag": "🇲🇺" },
    { "country": "Mexico", "currency_code": "MXN", "country_code": "+52", "flag": "🇲🇽" },
    { "country": "Micronesia", "currency_code": "USD", "country_code": "+691", "flag": "🇫🇲" },
    { "country": "Moldova", "currency_code": "MDL", "country_code": "+373", "flag": "🇲🇩" },
    { "country": "Monaco", "currency_code": "EUR", "country_code": "+377", "flag": "🇲🇨" },
    { "country": "Mongolia", "currency_code": "MNT", "country_code": "+976", "flag": "🇲🇳" },
    { "country": "Montenegro", "currency_code": "EUR", "country_code": "+382", "flag": "🇲🇪" },
    { "country": "Morocco", "currency_code": "MAD", "country_code": "+212", "flag": "🇲🇦" },
    { "country": "Mozambique", "currency_code": "MZN", "country_code": "+258", "flag": "🇲🇿" },
    { "country": "Myanmar", "currency_code": "MMK", "country_code": "+95", "flag": "🇲🇲" },
    { "country": "Namibia", "currency_code": "NAD", "country_code": "+264", "flag": "🇳🇦" },
    { "country": "Nauru", "currency_code": "AUD", "country_code": "+674", "flag": "🇳🇷" },
    { "country": "Nepal", "currency_code": "NPR", "country_code": "+977", "flag": "🇳🇵" },
    { "country": "Netherlands", "currency_code": "EUR", "country_code": "+31", "flag": "🇳🇱" },
    { "country": "New Zealand", "currency_code": "NZD", "country_code": "+64", "flag": "🇳🇿" },
    { "country": "Nicaragua", "currency_code": "NIO", "country_code": "+505", "flag": "🇳🇮" },
    { "country": "Niger", "currency_code": "NGN", "country_code": "+227", "flag": "🇳🇪" },
    { "country": "Nigeria", "currency_code": "NGN", "country_code": "+234", "flag": "🇳🇬" },
    { "country": "North Macedonia", "currency_code": "MKD", "country_code": "+389", "flag": "🇲🇰" },
    { "country": "Norway", "currency_code": "NOK", "country_code": "+47", "flag": "🇳🇴" },
    { "country": "Oman", "currency_code": "OMR", "country_code": "+968", "flag": "🇴🇲" },
    { "country": "Pakistan", "currency_code": "PKR", "country_code": "+92", "flag": "🇵🇰" },
    { "country": "Palau", "currency_code": "USD", "country_code": "+680", "flag": "🇵🇼" },
    { "country": "Panama", "currency_code": "PAB", "country_code": "+507", "flag": "🇵🇦" },
    { "country": "Papua New Guinea", "currency_code": "PGK", "country_code": "+675", "flag": "🇵🇬" },
    { "country": "Paraguay", "currency_code": "PYG", "country_code": "+595", "flag": "🇵🇾" },
    { "country": "Peru", "currency_code": "PEN", "country_code": "+51", "flag": "🇵🇪" },
    { "country": "Philippines", "currency_code": "PHP", "country_code": "+63", "flag": "🇵🇭" },
    { "country": "Poland", "currency_code": "PLN", "country_code": "+48", "flag": "🇵🇱" },
    { "country": "Portugal", "currency_code": "EUR", "country_code": "+351", "flag": "🇵🇹" },
    { "country": "Qatar", "currency_code": "QAR", "country_code": "+974", "flag": "🇶🇦" },
    { "country": "Romania", "currency_code": "RON", "country_code": "+40", "flag": "🇷🇴" },
    { "country": "Russia", "currency_code": "RUB", "country_code": "+7", "flag": "🇷🇺" },
    { "country": "Rwanda", "currency_code": "RWF", "country_code": "+250", "flag": "🇷🇼" },
    { "country": "Saint Kitts and Nevis", "currency_code": "XCD", "country_code": "+1-869", "flag": "🇰🇳" },
    { "country": "Saint Lucia", "currency_code": "XCD", "country_code": "+1-758", "flag": "🇱🇨" },
    { "country": "Saint Vincent and the Grenadines", "currency_code": "XCD", "country_code": "+1-784", "flag": "🇻🇨" },
    { "country": "Samoa", "currency_code": "WST", "country_code": "+685", "flag": "🇼🇸" },
    { "country": "San Marino", "currency_code": "EUR", "country_code": "+378", "flag": "🇸🇲" },
    { "country": "Sao Tome and Principe", "currency_code": "STN", "country_code": "+239", "flag": "🇸🇹" },
    { "country": "Saudi Arabia", "currency_code": "SAR", "country_code": "+966", "flag": "🇸🇦" },
    { "country": "Senegal", "currency_code": "XOF", "country_code": "+221", "flag": "🇸🇳" },
    { "country": "Serbia", "currency_code": "RSD", "country_code": "+381", "flag": "🇷🇸" },
    { "country": "Seychelles", "currency_code": "SCR", "country_code": "+248", "flag": "🇸🇨" },
    { "country": "Sierra Leone", "currency_code": "SLL", "country_code": "+232", "flag": "🇸🇱" },
    { "country": "Singapore", "currency_code": "SGD", "country_code": "+65", "flag": "🇸🇬" },
    { "country": "Slovakia", "currency_code": "EUR", "country_code": "+421", "flag": "🇸🇰" },
    { "country": "Slovenia", "currency_code": "EUR", "country_code": "+386", "flag": "🇸🇮" },
    { "country": "Solomon Islands", "currency_code": "SBD", "country_code": "+677", "flag": "🇸🇧" },
    { "country": "Somalia", "currency_code": "SOS", "country_code": "+252", "flag": "🇸🇴" },
    { "country": "South Africa", "currency_code": "ZAR", "country_code": "+27", "flag": "🇿🇦" },
    { "country": "South Sudan", "currency_code": "SSP", "country_code": "+211", "flag": "🇸🇸" },
    { "country": "Spain", "currency_code": "EUR", "country_code": "+34", "flag": "🇪🇸" },
    { "country": "Sri Lanka", "currency_code": "LKR", "country_code": "+94", "flag": "🇱🇰" },

    { "country": "Sudan", "currency_code": "SDG", "country_code": "+249", "flag": "🇸🇩" },
    { "country": "Suriname", "currency_code": "SRD", "country_code": "+597", "flag": "🇸🇷" },
    { "country": "Sweden", "currency_code": "SEK", "country_code": "+46", "flag": "🇸🇪" },
    { "country": "Switzerland", "currency_code": "CHF", "country_code": "+41", "flag": "🇨🇭" },
    { "country": "Syria", "currency_code": "SYP", "country_code": "+963", "flag": "🇸🇾" },
    { "country": "Taiwan", "currency_code": "TWD", "country_code": "+886", "flag": "🇹🇼" },
    { "country": "Tajikistan", "currency_code": "TJS", "country_code": "+992", "flag": "🇹🇯" },
    { "country": "Tanzania", "currency_code": "TZS", "country_code": "+255", "flag": "🇹🇿" },
    { "country": "Thailand", "currency_code": "THB", "country_code": "+66", "flag": "🇹🇭" },
    { "country": "Timor-Leste", "currency_code": "USD", "country_code": "+670", "flag": "🇹🇱" },
    { "country": "Togo", "currency_code": "XOF", "country_code": "+228", "flag": "🇹🇬" },
    { "country": "Tonga", "currency_code": "TOP", "country_code": "+676", "flag": "🇹🇴" },
    { "country": "Trinidad and Tobago", "currency_code": "TTD", "country_code": "+1-868", "flag": "🇹🇹" },
    { "country": "Tunisia", "currency_code": "TND", "country_code": "+216", "flag": "🇹🇳" },
    { "country": "Turkey", "currency_code": "TRY", "country_code": "+90", "flag": "🇹🇷" },
    { "country": "Turkmenistan", "currency_code": "TMT", "country_code": "+993", "flag": "🇹🇲" },
    { "country": "Tuvalu", "currency_code": "AUD", "country_code": "+688", "flag": "🇹🇻" },
    { "country": "Uganda", "currency_code": "UGX", "country_code": "+256", "flag": "🇺🇬" },
    { "country": "Ukraine", "currency_code": "UAH", "country_code": "+380", "flag": "🇺🇦" },
    { "country": "United Arab Emirates", "currency_code": "AED", "country_code": "+971", "flag": "🇦🇪" },
    { "country": "United Kingdom", "currency_code": "GBP", "country_code": "+44", "flag": "🇬🇧" },
    { "country": "United States", "currency_code": "USD", "country_code": "+1", "flag": "🇺🇸" },
    { "country": "Uruguay", "currency_code": "UYU", "country_code": "+598", "flag": "🇺🇾" },
    { "country": "Uzbekistan", "currency_code": "UZS", "country_code": "+998", "flag": "🇺🇿" },
    { "country": "Vanuatu", "currency_code": "VUV", "country_code": "+678", "flag": "🇻🇺" },
    { "country": "Vatican City", "currency_code": "EUR", "country_code": "+379", "flag": "🇻🇦" },
    { "country": "Venezuela", "currency_code": "VES", "country_code": "+58", "flag": "🇻🇪" },
    { "country": "Vietnam", "currency_code": "VND", "country_code": "+84", "flag": "🇻🇳" },
    { "country": "Yemen", "currency_code": "YER", "country_code": "+967", "flag": "🇾🇪" },
    { "country": "Zambia", "currency_code": "ZMK", "country_code": "+260", "flag": "🇿🇲" },
    { "country": "Zimbabwe", "currency_code": "ZWL", "country_code": "+263", "flag": "🇿🇼" }
];
    res.json(countriesData);
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
