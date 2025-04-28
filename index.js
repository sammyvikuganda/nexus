const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const app = express();
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');
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

const publicKey = process.env.TEZA_PUBLIC_KEY;
const secretKey = process.env.TEZA_SECRET_KEY;



app.use(cors());
app.use(express.json());


app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));




// Session setup
if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not set in environment variables');
}

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set to true only if using HTTPS
}));


// Login endpoint
app.post('/api/loginapp', async (req, res) => {
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



// Serve registration form with sponsor ID
app.get('/api/register', (req, res) => {
    const sponsorId = req.query.sponsorid || '';
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            <title>Welcome to Nexus - Register</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300&display=swap" rel="stylesheet">
            <style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Poppins', sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

.app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    header {
      background-color: #1A7EB1;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      flex-shrink: 0;
    }

    .header-logo {
      height: 36px;
    }

.header-title {
      flex: 1;
      text-align: center;
      font-size: 1.2rem;
      font-weight: bold;
      margin: 0;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    form {
      max-width: 500px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
.form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-group-inline {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    .form-group-inline .country {
      flex: 0.4;
    }

    .form-group-inline .phone {
      flex: 0.6;
    }


label {
      font-weight: 500;
      color: #555;
      font-size: 0.9rem;
    }

    input, select {
      width: 100%;
      padding: 0.8rem;
      border: 2px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.9rem;
      background-color: #f9fafc;
      height: 48px;
    }


input:focus, select:focus {
      border-color: #1A7EB1;
      outline: none;
      box-shadow: 0 0 8px rgba(26, 126, 177, 0.2);
      background-color: #ffffff;
    }

    input::placeholder {
      color: #a0aec0;
    }

    input[type="submit"] {
      background-color: #1A7EB1;
      color: white;
      border: none;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 1rem;
    }

input[type="submit"]:hover {
      background-color: #15608B;
      box-shadow: 0 4px 10px rgba(26, 126, 177, 0.2);
      transform: translateY(-2px);
    }

    .footer {
      text-align: center;
      font-size: 0.8rem;
      color: #555;
      padding: 20px 10px;
    }

    .footer a {
      color: #1A7EB1;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.3s ease;
    }
.footer a:hover {
      color: #15608B;
    }

    .error {
      color: red;
      font-size: 0.8rem;
      margin-top: 5px;
    }

    @media (max-width: 480px) {
      .header-logo {
        height: 28px;
      }

      .header-title {
        font-size: 1rem;
      }
input {
        padding: 0.7rem;
      }
    }

</style>
        </head>
        <body>
            <div class="app-container">
                <header>
                    <img class="header-logo" src="https://i.postimg.cc/rpRxknG4/1745596287655.png" alt="Left Logo" />
                    <h1 class="header-title">Create Nexus Account</h1>
                    <img class="header-logo" src="https://i.postimg.cc/rpRxknG4/1745596287655.png" alt="Right Logo" />
                </header>

                <div class="content">

<form id="registerForm" action="/api/register?sponsorid=${sponsorId}" method="POST">
                        <div class="form-group">
                            <label for="firstName">First Name</label>
                            <input name="firstName" id="firstName" placeholder="First Name" required />
                        </div>

                        <div class="form-group">
                            <label for="lastName">Last Name</label>

<input name="lastName" id="lastName" placeholder="Last Name" required />
                        </div>

                        <div class="form-group-inline">
                            <div class="form-group country">
                                <label for="country">Country</label>
                                <select name="country" id="country" required>
                                    <option value="">Select a country</option>

</select>
                            </div>
                            <div class="form-group phone">
                                <label for="phoneNumber">Phone Number</label>
                                <div style="display: flex; width: 100%; align-items: center;">
                                    <input type="tel" id="countryCode" readonly placeholder="+Code" style="width: 40%; padding: 0.8rem; border: 2px solid #e2e8f0; border-radius: 6px 0 0 6px;" />
                                    <input type="tel" name="phoneNumber" id="phoneNumber" placeholder="Enter number" required style="width: 60%; padding: 0.8rem; border: 2px solid #e2e8f0; border-radius: 0 6px 6px 0;" />
                                </div>

<p id="phoneError" class="error" style="display: none;"></p>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="email">Email</label>
                            <input name="email" id="email" placeholder="example@domain.com" required />
                        </div>

                        <div class="form-group">

<label for="pin">Set App Login PIN</label>
                            <input name="pin" id="pin" type="tel" placeholder="Create a secure PIN" required maxlength="5" />
                            <p id="pinError" class="error" style="display: none;"></p>
                        </div>

                        <div class="form-group">
                            <input type="submit" value="Get Started" />
                        </div>
                    </form>
                </div>

<div class="footer">
                    <p>&copy; 2025 Nexus. All rights reserved. <a href="/">Home</a></p>
                </div>
            </div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    const countrySelect = document.getElementById('country');
    const codeInput = document.getElementById('countryCode');
    const phoneInput = document.getElementById('phoneNumber');
    const phoneError = document.getElementById('phoneError');
    const pinInput = document.getElementById('pin');
    const pinError = document.getElementById('pinError');
    let countries = [], selected = null;

    fetch('https://upay-2r8z6g7xc-nexus-int.vercel.app/api/countries')
      .then(res => res.json())
      .then(data => {
        countries = data;
        data.forEach(({ country, country_code, flag, phone_length }) => {
          const opt = new Option(flag + ' ' + country, country); // Set value as country name
          opt.dataset.code = country_code;
          opt.dataset.len = phone_length;
          countrySelect.add(opt);
        });
      });

    countrySelect.onchange = () => {
      selected = countries.find(c => c.country === countrySelect.value);
      codeInput.value = selected ? selected.country_code : '';
      phoneInput.value = '';
phoneError.style.display = 'none';
    };

    phoneInput.oninput = () => {
      if (selected && phoneInput.value.length === selected.phone_length) {
        phoneError.style.display = 'none';
      }
    };

document.getElementById('registerForm').onsubmit = e => {
      pinError.style.display = 'none';
      phoneError.style.display = 'none';

      if (!selected || phoneInput.value.length !== selected.phone_length || pinInput.value.length < 5) {
        e.preventDefault();
        if (!selected) {
          phoneError.textContent = 'Please select a valid country.';
        } else if (phoneInput.value.length !== selected.phone_length) {
          phoneError.textContent = 'Phone number must be exactly ' + selected.phone_length + ' digits for ' + selected.country + '.';
        } else {

pinError.textContent = 'PIN must be at least 5 characters long.';
          pinError.style.display = 'block';
        }
        phoneError.style.display = 'block';
      } else {
        // Properly prepend country code to phone number
        phoneInput.value = selected.country_code + ' ' + phoneInput.value.trim();
      }
    };
  });
</script>

</body>
        </html>
    `);
});


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
    const { phoneNumber, country, firstName, lastName, dob, nin, email, pin, deviceDetails } = req.body;
    const sponsorId = req.query.sponsorid;

    // Detect if the request came from a form
    const isFormRequest = req.headers['content-type']?.includes('application/x-www-form-urlencoded');

    try {
        const { credentialsExist, deviceExists } = await checkIfExists(phoneNumber, email, nin, deviceDetails);


if (credentialsExist && deviceExists) {
            if (isFormRequest) {
                return res.send(`
                    <script>
                        alert('Some of the credentials you provided are already registered, and you cannot register another account using this device.');
                        window.history.back();
                    </script>
                `);
            } else {
                return res.status(400).json({
                    message: 'Some of the credentials you provided are already registered, and you cannot register another account using this device.'
                });
}
        }

        if (credentialsExist) {
            if (isFormRequest) {
                return res.send(`
                    <script>
                        alert('Some of the credentials you provided already exist. If you have registered previously, please log in.');
                        window.history.back();
                    </script>
                `);
            } else {
                return res.status(400).json({
message: 'Some of the credentials you provided already exist. If you have registered previously, please log in.'
                });
            }
        }

        if (deviceExists) {
            if (isFormRequest) {
                return res.send(`
                    <script>
                        alert('You cannot register another account using this device.');
                        window.history.back();
                    </script>

`);
            } else {
                return res.status(400).json({
                    message: 'You cannot register another account using this device.'
                });
            }
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
const userData = {
            phoneNumber,
            country,
            firstName,
            lastName,
            nin: nin || null,
            email,
            pin,
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

        if (dob) {
            userData.dob = dob;
        }

        await db.ref(`users/${userId}`).set(userData);

        try {
            const secondaryResponse = await axios.post('https://upay-5iyy6inv7-sammyviks-projects.vercel.app/api/create-user', {
                userId: userId,
            });

if (secondaryResponse.data.userId) {
                if (isFormRequest) {
                    return res.redirect('https://www.google.com');
                } else {
                    return res.json({
                        message: 'User registered successfully and replicated in secondary database',
                        userId: userId
                    });
                }
            } else {
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
        if (isFormRequest) {
            return res.send(`
                <script>
                    alert('An unexpected error occurred while registering. Please try again later.');

window.history.back();
                </script>
            `);
        } else {
            return res.status(500).json({
                message: 'Error registering user',
                error
            });
        }
    }
});


// Endpoint to handle withdrawal request
app.post('/api/withdraw', async (req, res) => {
  // Destructure the required data from the request body
  const { mobile, amount, tx, description } = req.body;

  // Validate required fields
  if (!mobile || !amount || !tx || !description) {
    return res.status(400).json({ message: 'Mobile number, amount, transaction ID, and description are required.' });
  }


// Get environment variables (ensure they are set in Vercel or locally)
  const JPESA_API_KEY = process.env.JPESA_API_KEY; // Using JPESA_API_KEY for the JPesa API key
  const CALLBACK_URL = process.env.CALLBACK_URL;

  // Check if the environment variables are set
  if (!JPESA_API_KEY || !CALLBACK_URL) {
    return res.status(500).json({ message: 'JPesa API Key or Callback URL missing in environment variables.' });
  }

// Construct the XML data using dynamic user inputs
  const DATA = `<?xml version="1.0" encoding="ISO-8859-1"?>
    <g7bill>
      <_key_>${JPESA_API_KEY}</_key_>
      <cmd>account</cmd>
      <action>debit</action>
      <pt>mm</pt>
      <mobile>${mobile}</mobile>
      <amount>${amount}</amount>
      <callback>${CALLBACK_URL}</callback>
      <tx>${tx}</tx>
      <description>${description}</description>
    </g7bill>`;

try {
    // Send the request to JPesa API
    const response = await axios.post('https://my.jpesa.com/api/', DATA, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });

    // Log the response from JPesa API for debugging
    console.log(response.data);

    // Send success response to the client
    res.status(200).json({ message: 'Withdrawal request sent successfully!', data: response.data });
  } catch (error) {

// Handle error and send a failure response
    console.error('Error sending request to JPesa:', error);
    res.status(500).json({ message: 'Error processing withdrawal', error: error.message });
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


// Endpoint to handle both Top Up and Withdraw
app.patch('/api/update-balance', async (req, res) => {
  const { userId, amount, reason, phone } = req.body;

  if (!userId || amount === undefined || !reason || !phone) {
    return res.status(400).json({ message: 'User ID, amount, reason, and phone are required' });
  }

  try {
    // Check server status before processing the request
    const serverStatusRef = db.ref('serverStatus');
    const serverStatusSnapshot = await serverStatusRef.once('value');

const serverStatus = serverStatusSnapshot.val();

    // If server status is busy, only allow Top Up
    if (serverStatus === 'busy' && reason !== 'Top Up') {
      return res.status(403).json({ message: 'Server is currently busy. Only Top Up operations are allowed.' });
    }

    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found' });
                          }

const user = snapshot.val();
    const currentBalance = user.balance || 0;
    const sponsorCode = user.sponsorCode || null;
    const reference = `ref-${userId}-${Date.now()}`;

    const formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');

    let tezaApiUrl = '';
    let tezaApiData = {
      apikey: publicKey,
      reference: reference,
      phone: formattedPhone,
      amount: amount,
      description: `${reason} request for user: ${userId}`
    };

let companyTax = 0;
    let companyCollection = 0;
    let sponsorCommission = 0;

    if (reason === 'Withdraw') {
      if (currentBalance < amount) {
        return res.status(400).json({ message: 'Insufficient balance for withdrawal' });
      }

      const amountToSend = amount * 0.9;
      tezaApiData.amount = amountToSend;
      tezaApiUrl = 'https://tezanetwork.com/api/v1/withdraw';

      companyTax = amount * 0.08;

if (sponsorCode) {
        const sponsorRef = db.ref(`users/${sponsorCode}`);
        const sponsorSnapshot = await sponsorRef.once('value');
        if (sponsorSnapshot.exists()) {
          sponsorCommission = amount * 0.02;
        }
      } else {
        companyCollection = amount * 0.02;
      }
    } else if (reason === 'Top Up') {
      tezaApiUrl = 'https://tezanetwork.com/api/v1/deposit';
    } else {

return res.status(400).json({ message: 'Invalid reason. Must be "Withdraw" or "Top Up"' });
    }

    try {
      const tezaResponse = await axios.post(tezaApiUrl, tezaApiData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`
        }
      });

      if (tezaResponse.status >= 200 && tezaResponse.status < 300) {
        const { status, transaction_id } = tezaResponse.data;

if (status === 'success') {
          const transactionsRef = userRef.child('transactions');
          const newTransactionRef = transactionsRef.push();

          await newTransactionRef.set({
            amount: amount,
            reason: reason,
            transactionId: transaction_id,
            reference: reference,
            phone: phone,
            status: 'pending',
            timestamp: new Date().toISOString()
          });
if (reason === 'Withdraw') {
            const newBalance = currentBalance - amount;
            await userRef.update({ balance: newBalance });

            // Update company tax and collection by adding to existing values
            const companyRef = db.ref('companyData');
            const companySnapshot = await companyRef.once('value');
            const companyData = companySnapshot.val() || {};
            await companyRef.update({
              companyTax: (companyData.companyTax || 0) + companyTax,
              companyCollection: (companyData.companyCollection || 0) + companyCollection

});
          }

          // Update sponsor referral commission if valid
          if (sponsorCode && sponsorCommission > 0) {
            const sponsorRef = db.ref(`users/${sponsorCode}`);
            const sponsorSnapshot = await sponsorRef.once('value');
            if (sponsorSnapshot.exists()) {
              const sponsorUser = sponsorSnapshot.val();
const newReferralCommission = (sponsorUser.referralCommission || 0) + sponsorCommission;
              await sponsorRef.update({ referralCommission: newReferralCommission });
            }
          }

          return res.status(200).json({
            message: `${reason} initiated successfully`,
            transactionId: transaction_id,
            reference
          });
        } else {
return res.status(422).json({
            message: `Failed to initiate ${reason.toLowerCase()} with Teza`,
            details: tezaResponse.data.message || 'Unknown error'
          });
        }
      } else {
        return res.status(422).json({
          message: `Failed to initiate ${reason.toLowerCase()} with Teza`,
          details: tezaResponse.data.message || 'Unknown error'
        });
      }
    } catch (error) {
console.error(`Error during Teza ${reason.toLowerCase()} submission:`, error);
      return res.status(500).json({
        message: `Failed to submit ${reason.toLowerCase()} to Teza`,
        error: error.message
      });
    }

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ message: 'Error processing request', error: error.message });
  }
});




// Endpoint to manually process all failed logs (supports both GET and POST)
app.all('/api/process-failed-logs', async (req, res) => {
  if (req.method === 'POST' || req.method === 'GET') {
    try {
      const usersSnapshot = await db.ref('users').once('value');
      
      if (!usersSnapshot.exists()) {
        return res.status(404).json({ message: 'No users found' });
      }

      const users = usersSnapshot.val();

      // Loop through each user
      for (let userId in users) {

const userRef = db.ref(`users/${userId}`);
        const transactionsRef = userRef.child('transactions');

        // Get failed logs for the user
        const failedLogsSnapshot = await userRef.child('failed_logs').once('value');

        if (failedLogsSnapshot.exists()) {
          const failedLogs = failedLogsSnapshot.val();

          // Loop through each failed log and process
          for (let logId in failedLogs) {
            const failedLog = failedLogs[logId];

const reference_id = failedLog.reference_id;
            const transaction_id = failedLog.transaction_id;
            const failedStatus = failedLog.status;  // Get the status from the failed log ('Approved' or 'Failed')

            // Look for the transaction by reference_id
            const transactionSnapshot = await transactionsRef
              .orderByChild('reference')
              .equalTo(reference_id)
              .once('value');

if (transactionSnapshot.exists()) {
              // Find the transaction
              const transactionKey = Object.keys(transactionSnapshot.val())[0];
              const transaction = transactionSnapshot.val()[transactionKey];

              // Update the transaction status based on the failed log's status
              const updatedStatus = (failedStatus === 'Approved') ? 'completed' : failedStatus;
await transactionsRef.child(transactionKey).update({
                status: updatedStatus,  // Update status to 'completed' if Approved, or keep it 'Failed'
                timestamp: new Date().toISOString(),
              });

              // Delete the failed log after processing
              await userRef.child('failed_logs').child(logId).remove();

              console.log(`Transaction with reference ${reference_id} processed and status updated to ${updatedStatus}.`);
            } else {

console.log(`Transaction with reference ${reference_id} not found for user ${userId}.`);
            }
          }
        }
      }

      return res.status(200).json({ message: 'All failed logs processed successfully.' });
    } catch (error) {
      console.error('Error processing failed logs:', error);
      return res.status(500).json({ message: 'Failed to process logs', error: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });


}
});




// Endpoint to process failed logs for a specific user by userId
app.all('/api/process-failed-logs/:userId', async (req, res) => {
  const { userId } = req.params;

  if (req.method === 'POST' || req.method === 'GET') {
    try {
      const userRef = db.ref(`users/${userId}`);
      const transactionsRef = userRef.child('transactions');

      // Check if the user exists
      const userSnapshot = await userRef.once('value');
      if (!userSnapshot.exists()) {
        return res.status(404).json({ message: `User with ID ${userId} not found` });

}

      // Get the failed logs for the specific user
      const failedLogsSnapshot = await userRef.child('failed_logs').once('value');
      if (!failedLogsSnapshot.exists()) {
        return res.status(404).json({ message: `No failed logs found for user ${userId}` });
      }

      const failedLogs = failedLogsSnapshot.val();
      let processedCount = 0;
      let skippedCount = 0;
      let failedToProcess = 0;

      // Process each failed log independently

for (let logId in failedLogs) {
        const failedLog = failedLogs[logId];
        const { reference_id, transaction_id, status: failedStatus } = failedLog;

        try {
          const transactionSnapshot = await transactionsRef
            .orderByChild('reference')
            .equalTo(reference_id)
            .once('value');

          if (transactionSnapshot.exists()) {
            const transactionKey = Object.keys(transactionSnapshot.val())[0];
            const transaction = transactionSnapshot.val()[transactionKey];

const updatedStatus = failedStatus === 'Approved' ? 'completed' : failedStatus;

            // Use the original timestamp from the transaction, not the current time
            const transactionTimestamp = transaction.timestamp || new Date().toISOString();

            await transactionsRef.child(transactionKey).update({
              status: updatedStatus,
              timestamp: transactionTimestamp,  // Keep the original timestamp
            });

console.log(`Transaction ${reference_id} updated to ${updatedStatus} with original timestamp.`);

            // Only delete log after successful processing
            await userRef.child('failed_logs').child(logId).remove();
            console.log(`Processed and deleted log ${logId}.`);
            processedCount++;
          } else {
            console.log(`Transaction ${reference_id} not found. Log ${logId} kept for retry.`);
            skippedCount++;
          }

        } catch (logErr) {
console.error(`Error processing log ${logId}:`, logErr);
          failedToProcess++;
        }
      }

      return res.status(200).json({
        message: `Logs processed for user ${userId}.`,
        processedLogs: processedCount,
        skippedLogs: skippedCount,
        failedLogs: failedToProcess,
      });

    } catch (error) {
      console.error('Unexpected error while processing failed logs:', error);
      return res.status(500).json({ message: 'Failed to process logs', error: error.message });

}
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
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





// ================== LOGOUT ==================
app.get('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/api/login');
    });
});










// Dashboard page
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
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dashboard</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

<style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300&display=swap');

body {
  font-family: 'Poppins', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            transition: all 2.9s ease-in-out;
        }

        








    
        




          /* Support Header styles */
#support-header {
    display: flex;
    align-items: center;
    justify-content: center; /* Center content horizontally */
    padding: 10px;
    background-color: #1A7EB1;
    color: white;
    border-bottom: 1px solid #ccc;
    height: 50px; /* Adjust height as needed */
}

#support-header h1 {
    margin: 0;
    font-size: 22px; /* Slightly reduced font size */
    line-height: 1.2; /* Adjust line-height to move text down */
    padding-top: 10px; /* Add padding to move text slightly down */
    font-weight: 400; /* Subtle reduction in boldness */
}

/* Container for support text */
.support-container {
    padding-bottom: 10px;
    padding-top: 10px;
    display: flex;
    align-items: center; /* Align items vertically in the center */
    margin: 20px; /* Space around the container */
    font-size: 16px; /* Adjusted base font size */
    color: #333;
    position: relative; /* To position the icon absolutely */
    cursor: pointer; /* Change cursor to pointer on hover */
    overflow: hidden; /* Hide overflow to ensure the effect stays within bounds */
}

/* Add pseudo-element for the effect */
.support-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 100%; /* Start off the left edge */
    bottom: 0;
    right: 0;
    background: #f2f2f2; /* Color of the effect */
    transition: left 0.2s ease-out; /* Shortened transition duration */
    z-index: -1; /* Ensure the effect is behind the content */
}

.support-container:active::before {
    left: 0; /* Move effect from left to right */
}

/* Circle with 'S' */
.support-circle {
    width: 30px; /* Reduced size of the circle */
    height: 30px;
    border-radius: 50%; /* Make it a circle */
    background-color: #1A7EB1; /* Background color */
    color: white; /* White text color */
    display: flex;
    align-items: center; /* Center text vertically */
    justify-content: center; /* Center text horizontally */
    margin-right: 10px; /* Space between circle and text */
    font-size: 16px; /* Reduced size of the 'S' */
}

/* Text styles */
.support-text {
    display: flex;
    flex-direction: column;
    text-align: left; /* Align text to the left */
    margin-right: 60px; /* Create space for the icon on the right */
}

.support-text p {
    margin: 0; /* Remove default margin */
    line-height: 1.2; /* Adjust line height if needed */
}

/* Text for 'CHAT WITH US' */
.support-text #support-text {
    font-size: 16px; /* Slightly reduced font size */
    color: black; /* Black text color */
    font-weight: bold; /* Bold text */
}

/* Text for 'Tap here to text us' */
.support-text #support-tap-to-text {
    font-size: 12px; /* Reduced font size */
    color: grey; /* Gray text color */
}

/* Icon styles */
.support-icon {
    width: 10px; /* Smaller size of the icon */
    height: 20px;
    position: absolute; /* Position the icon absolutely */
    right: 20px; /* Distance from the right edge of the container */
}

/* Make anchor tags fill the container */
.support-link {
    text-decoration: none; /* Remove underline */
    color: inherit; /* Inherit text color */
    display: block; /* Make the anchor tag a block-level element */
    transition: background-color 0.2s ease, opacity 0.2s ease; /* Shortened transition duration */
    outline: none; /* Removes the default outline */
    -webkit-tap-highlight-color: transparent; /* Removes the tap highlight color on touch devices */
}




/* General Modal Styles */
.modal,
.logout-modal,
.error-modal {
    display: none;
    position: fixed;
    z-index: 10000; /* Ensure modals are on top */
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.4);
}

/* Modal Content Styles */
.modal-content,
.logout-modal-content,
.error-modal-content {
    background-color: #fefefe;
    margin: auto;
    padding: 30px 20px;
    border: 1px solid #888;
    border-radius: 8px;
    position: absolute;
    top: 40%; /* Move modal up slightly */
    left: 50%;
    transform: translate(-50%, -50%); /* Center the modal with an offset */
    width: 80%;
    max-width: 500px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

/* Label Styles */
.modal-content label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    font-size: 14px;
}

/* Input Field Styles */
.modal-content input {
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    box-sizing: border-box;
    border: none;
    border-bottom: 2px solid #f44336;
    outline: none;
    font-size: 15px;
    -moz-appearance: textfield;
    appearance: textfield;
}

/* Input Focus Styles */
.modal-content input:focus {
    border-bottom: 2px solid #333;
}

/* Modal Buttons Styles */
.modal-buttons {
    display: flex;
    justify-content: space-between;
    margin-top: 15px;
}

/* Button Styles */
.modal-buttons button {
    width: 46%;
    padding: 8px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s ease, opacity 0.1s ease, transform 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

/* Cancel Button Styles */
.modal-buttons button.cancel {
    background-color: #fff;
    color: #f44336;
    border: 2px solid #f44336;
}

/* Send Button Styles */
.modal-buttons button.send {
    background-color: #f44336;
    color: white;
}

/* Button Hover and Active Styles */
.modal-buttons button:hover:active {
    opacity: 0.1;
}

.modal-buttons button:active {
    transform: scale(0.95);
}

/* Logout Modal Styles */
.logout-modal-content {
    margin: auto;
    padding: 20px;
    width: 70%;
    max-width: 400px;
    text-align: center;
    border-radius: 20px;
    position: absolute;
    top: 40%; /* Move modal up slightly */
    left: 50%;
    transform: translate(-50%, -50%); /* Center the modal with an offset */
}

.logout-modal-content h2 {
    font-weight: normal;
    margin: 10px 0;
}

.logout-modal-content p {
    color: grey;
    margin-bottom: 15px;
}

.logout-button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
}

.logout-button {
    padding: 10px 20px;
    cursor: pointer;
    border: none;
    border-radius: 30px;
    font-size: 16px;
    width: 150px;
    transition: background-color 0.1s ease, opacity 0.1s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.logout-confirm {
    background-color: red;
    color: white;
    font-weight: normal;
}

.logout-cancel {
    background-color: white;
    color: red;
    border: 2px solid red;
    font-weight: normal;
}

.logout-button:active {
    opacity: 0.1;
    transform: scale(0.95);
}

/* Error Modal Styles */
.error-modal-content {
    margin: auto;
    padding: 15px;
    width: 70%;
    max-width: 350px;
    text-align: center;
    border-radius: 20px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    position: absolute;
    top: 40%; /* Move modal up slightly */
    left: 50%;
    transform: translate(-50%, -50%); /* Center the modal with an offset */
}

#errorTitle {
    color: black;
    font-weight: normal;
    font-size: 18px;
    margin-bottom: 8px;
}

#errorMessage {
    color: grey;
    font-size: 14px;
    margin-bottom: 12px;
}

#errorModalCloseButton {
    background-color: white;
    color: red;
    border: 2px solid red;
    padding: 12px;
    width: 150px;
    cursor: pointer;
    border-radius: 28px;
    font-size: 16px;
    display: inline-block;
    text-align: center;
    transition: background-color 0.3s ease, opacity 0.1s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

#errorModalCloseButton:hover {
    background-color: white;
    color: red;
}

#errorModalCloseButton:active {
    opacity: 0.1;
    transform: scale(0.95);
}









.modal-required {
    display: none; /* Hidden by default */
    position: fixed; /* Stay in place */
    z-index: 1000; /* Sit on top, ensure higher z-index */
    left: 0;
    top: 0;
    width: 100%; /* Full width */
    height: 100%; /* Full height */
    overflow: auto; /* Enable scroll if needed */
    background-color: rgba(0, 0, 0, 0.4); /* Black with opacity */
}

.modal-content-required {
    background-color: #fefefe;
    position: absolute; /* Position the modal */
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%); /* Center the modal */
    padding: 15px;
    border: 1px solid #888;
    width: 70%; /* Slightly larger modal width */
    max-width: 350px; /* Increase max-width slightly */
    border-radius: 15px;
    text-align: center; /* Center text */
    box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.2); /* Optional shadow for better appearance */
}

.modal-heading {
    font-size: 18px; /* Heading text size */
    color: #333; /* Heading text color */
    margin-bottom: 15px; /* Space below the heading */
}

.close-required {
    background-color: red; /* Red background */
    color: white; /* White text */
    border: 2px solid red; /* Red border */
    padding: 12px 40px; /* Increased button padding for wider button */
    border-radius: 28px; /* Button border radius increased */
    font-size: 16px; /* Increased button font size */
    font-weight: bold;
    cursor: pointer;
    margin-top: 15px;
    text-transform: uppercase; /* Optional: Make the button text uppercase */
    transition: opacity 0.1s ease; /* Add transition for opacity */
}

.close-required:hover,
.close-required:focus {
    background-color: red; /* Darker red on hover */
    transition: background-color 0.3s ease, opacity 0.1s ease; /* Add transition for opacity */
    outline: none; /* Removes the default outline */
    -webkit-tap-highlight-color: transparent; /* Removes the tap highlight color on touch devices */
}

.close-required:active {
    opacity: 0.1; /* Fading effect on active state */
}

.cancel-required {
    background-color: white; /* White background */
    color: red; /* Red text */
    border: 2px solid red; /* Red border */
    padding: 12px 40px; /* Same padding as close button */
    border-radius: 28px; /* Same border radius as close button */
    font-size: 16px; /* Same font size as close button */
    font-weight: bold;
    cursor: pointer;
    margin-top: 15px; /* Add margin to space out from the close button */
    text-transform: uppercase; /* Optional: Make the button text uppercase */
    transition: opacity 0.1s ease; /* Add transition for opacity */
}

.cancel-required:hover,
.cancel-required:focus {
    background-color: #f2f2f2; /* Slightly darker white on hover */
    transition: background-color 0.3s ease, opacity 0.1s ease; /* Add transition for opacity */
    outline: none; /* Removes the default outline */
    -webkit-tap-highlight-color: transparent; /* Removes the tap highlight color on touch devices */
}


.cancel-required:active {
    opacity: 0.1; /* Fading effect on active state */
}



.game-header {
  background-color: #1A7EB1;
  color: white;
  padding: 10px 0;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 1px;
  text-transform: uppercase;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10;
}

.game-content {
  margin-top: 60px; /* Make space for the fixed header */
  padding: 0 2px;
  overflow-y: auto;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.game-image-container {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 5px;
  margin-bottom: 20px;
}

.game-image-container a {
  display: block;
  width: 250px;
  border-radius: 12px;
  overflow: hidden;
  background-image: linear-gradient(
    45deg,
    #ffcc00,
    #d40000,
    #a020f0,
    #ffcc00
  );
  background-size: 300% 300%;
  animation: game-casinoGlow 2s linear infinite;
  text-align: center;
  padding-bottom: 10px;
  text-decoration: none;
}

@keyframes game-casinoGlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.game-image-container img {
  width: 100%;
  max-height: 200px;
  display: block;
}

.game-name {
  font-size: 18px;
  font-weight: bold;
  color: #ffcc00;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 10px;
}




/*💵 Investment CSS */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  background-color: #1A7EB1;
  color: white;
  text-align: center;
  padding: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  flex-shrink: 0;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1px;
  padding-bottom: 80px; /* Prevent content being hidden behind nav */
  box-sizing: border-box;
}

    .top-info {
      display: flex;
      justify-content: space-around;
      padding: 6px 10px;
    }

    .info-box {
      text-align: center;
    }

    .info-box h4 {
      margin: 0;
      font-size: 0.8rem;
      color: #666;
    }

    .info-box p {
      margin: 2px 0 0;
      font-size: 0.95rem;
      font-weight: bold;
      background: linear-gradient(90deg, #ff00cc, #3333ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .circle-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 6px;
    }

    

    .circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: conic-gradient(#ff00cc 30%, #eee 30%);
      position: relative;
    }

    .circle-inner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }

    .circle-inner h5 {
      margin: 0;
      font-size: 0.75rem;
      color: #666;
    }

    .circle-inner p {
      margin: 3px 0 0;
      font-size: 0.95rem;
      font-weight: bold;
      background: linear-gradient(to right, #ff00cc, #3333ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .buttons {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 12px auto 4px;
    }

    .buttons button {
      background: linear-gradient(135deg, #ff00cc, #3333ff);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 0.8rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .info-text {
      text-align: center;
      font-size: 0.65rem;
      color: #666;
      padding: 4px 12px 10px;
      max-width: 300px;
      margin: 0 auto;
      line-height: 1.2;
    }

    .section-title {
      text-align: center;
      font-size: 0.85rem;
      font-weight: bold;
      color: #333;
      margin: 12px 0 5px;
    }

    .transaction-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 16px 20px;
    }

    .transaction-card {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-left: 5px solid #ff5733;
    }

    .transaction-info {
      flex: 1;
      margin-left: 12px;
    }

    .transaction-info h4 {
      margin: 0;
      font-size: 0.95rem;
      color: #333;
      font-weight: bold;
    }

    .transaction-info p {
      margin: 3px 0;
      color: #666;
      font-size: 0.85rem;
    }

    .transaction-amount {
      font-size: 1.1rem;
      font-weight: bold;
      color: #ff5733;
      background: linear-gradient(90deg, #ff5733, #ffcc00);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

  .label-free {
  color: #FF6347;
  font-weight: bold;
  background-color: rgba(255, 99, 71, 0.2);
  padding: 3px 6px;
  border-radius: 5px;
  border: 2px solid #FF6347;
  text-transform: uppercase;
  font-size: 8px;
  letter-spacing: 0.2px;
}


   .label-premium {
  font-size: 0.55rem;
  font-weight: bold;
  padding: 4px 10px;
  background: linear-gradient(135deg, #FFD700, #FFB700, #FFA500);
  color: black; /* Set text color to black */
  border: 2px solid #FFD700;
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-transform: uppercase;
  letter-spacing: 1px;

  /* Remove text clipping */
  -webkit-background-clip: unset;
  -webkit-text-fill-color: unset;
}



.label-text {
      font-size: 0.85rem;
      font-weight: bold;
      color: #555;
    }



   .countdown-text {
  font-size: 0.8rem;
  font-weight: bold;
  color: #2E8B57;
  text-align: center;
  margin: 6px auto;
  padding: 4px 8px;
  background-color: #E6F4EA;
  border: 1px solid #2E8B57;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  display: block;
  width: fit-content;
}




/* Bottom Navigation Container */
        .bottom-nav {
            display: flex;
            justify-content: center;
            background-color: white;
            padding: 8px 0; /* Increased padding for more height */
            position: fixed;
            bottom: 0;
            width: 100%;
            border-top: 1px solid #d3d3d3;
            z-index: 1;
        }

        /* Bottom Navigation Items Wrapper */
        .nav-items-wrapper {
            display: flex;
            justify-content: space-between;
            width: 100%;
            max-width: 420px; /* Limit the width of the navigation */
        }

        /* Bottom Navigation Items */
        .bottom-nav .nav-item {
            text-align: center;
            margin: 0;
            padding: 5px;
            cursor: pointer;
            transition: opacity 0.2s ease, color 0.2s ease;
            outline: none;
            -webkit-tap-highlight-color: transparent;
            flex: 1;
        }

        /* Centered Games Icon (Updated) */
        .bottom-nav .nav-item.wallet {
            flex: 0; /* Prevent it from stretching */
        }

        .bottom-nav .nav-item i {
            font-size: 23px; /* Set icon size */
            margin-bottom: 1px;
            transition: transform 0.3s ease;
        }

        /* Make the Wallet icon the biggest */
        .bottom-nav .nav-item.wallet i {
            font-size: 35px; /* Adjusted for the wallet icon */
            color: white;
            background-color: #D3D3D3; /* Grey circle background */
            padding: 15px; /* Adjust size of the circle */
            border-radius: 50%; /* Make it a circle */
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); /* Optional: add shadow for effect */
            margin-top: -35px; /* Adjust vertical position */
            transition: all 0.3s ease;
        }

        /* Add glowing gradient effect for the 'Games' button */
        .bottom-nav .nav-item.wallet:hover i {
            background: linear-gradient(45deg, #ff6a00, #ee0979); /* Bright gradient colors for gaming */
            box-shadow: 0 0 15px 5px rgba(255, 105, 180, 0.8), 0 0 20px 10px rgba(255, 0, 150, 0.5); /* Glowing effect */
        }

        /* Specific rule for inactive state of wallet icon */
        .bottom-nav .nav-item.wallet.inactive i {
            color: white; /* Make Wallet icon white when inactive */
            background-color: #D3D3D3; /* Inactive state: Grey background */
        }

        /* When Wallet is active */
        .bottom-nav .nav-item.wallet.active i {
            background-color: #1A7EB1; /* Active state: Background changes */
            color: white; /* Icon remains white */
        }

        .bottom-nav .nav-item.wallet p {
            position: relative;
            top: 9px; /* Adjusted to align with the new height */
            margin: 0;
            font-size: 10px;
            font-weight: bold;
            color: #666;
        }

        .bottom-nav .nav-item p {
            margin: 0;
            font-size: 10px;
            font-weight: bold;
            color: #666;
        }

        /* Active state styling for the text and icon */
        .bottom-nav .nav-item.active i,
        .bottom-nav .nav-item.active p {
            color: #1A7EB1; /* Active color for both icon and text */
        }

        /* Inactive state styling */
        .bottom-nav .nav-item.inactive i,
        .bottom-nav .nav-item.inactive p {
            color: #D3D3D3; /* Inactive color for both icon and text */
        }

        /* Fading effect on active (click) state */
        .bottom-nav .nav-item:active {
            opacity: 0.2;
        }




.withdraw-bottom-sheet {
      position: fixed;
      bottom: -100%;
      left: 0;
      right: 0;
      background-color: white;
      height: 100%;
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .withdraw-bottom-sheet.open {
      bottom: 0;
    }

    .withdraw-header {
      background-color: #1A7EB1;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 25px 16px; /* Slightly reduced padding */
      font-size: 22px; /* Slightly smaller font */
      font-weight: bold;
      position: relative;
    }

    .withdraw-header .withdraw-title {
      position: absolute;
      left: 0;
      right: 0;
      text-align: center;
      pointer-events: none;
    }

    .withdraw-back-arrow {
      position: absolute;
      left: 16px;
      font-size: 20px; /* Slightly smaller back arrow */
      color: white;
      cursor: pointer;
    }

    .withdraw-form {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 14px;
      overflow-y: auto;
      align-items: center;
    }

    .withdraw-form-group {
      width: 90%;
      margin-bottom: 14px; /* Slightly reduced margin */
    }

    .withdraw-form-group label {
      font-size: 14px; /* Slightly smaller font */
      font-weight: bold;
      color: #333;
      margin-bottom: 5px; /* Slightly smaller margin */
      display: block;
    }

    .withdraw-form-group input {
      width: 100%;
      padding: 10px; /* Slightly smaller padding */
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px; /* Slightly smaller font */
      box-sizing: border-box;
    }

    .withdraw-form-group input:focus {
      border-color: #1A7EB1;
      outline: none;
    }

    .withdraw-insufficient-balance {
      color: red;
      font-size: 14px; /* Slightly smaller font */
      margin-bottom: 6px; /* Slightly smaller margin */
      text-align: center;
      display: none;
    }

    .withdraw-form button {
      padding: 12px;
      background-color: #1A7EB1;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px; /* Slightly smaller font */
      font-weight: bold;
      cursor: pointer;
      width: 90%;
      box-sizing: border-box;
    }

    .withdraw-form button:hover {
      background-color: #167AA6;
    }

    .withdraw-open-bottom-sheet-btn {
      padding: 12px 18px; /* Slightly smaller padding */
      background-color: #1A7EB1;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px; /* Slightly smaller font */
      font-weight: bold;
      cursor: pointer;
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 36px);
      box-sizing: border-box;
    }



.app-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .home-section {
      background: linear-gradient(to right, #1A7EB1, #1A7EB1);
      color: white;
      padding: 20px;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    /* CSS to increase the icon size */
.user-icon i {
    font-size: 50px;
}


    .user-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .user-info h2 {
      margin: 0;
      font-size: 16px;
      line-height: 1.4;
      display: flex;
      align-items: center;
    }

    .user-info h2 .verified-icon {
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: white;
      border-radius: 50%;
      width: 14px;
      height: 14px;
      margin-left: 5px;
    }

    .user-info h2 .verified-icon i {
      color: #1A7EB1;
      font-size: 10px;
      font-weight: bold;
    }

    .user-info p {
      font-size: 12px;
      margin-top: -4px;
      line-height: 1.5;
      font-weight: 300;
    }

    .header-right {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .notification-icon {
      font-size: 24px;
      color: white;
      cursor: pointer;
      transition: opacity 0.3s ease;
    }

    .notification-icon:active {
      opacity: 0.7;
    }

    .balance-wrapper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 30px;
    }

    .balance-container {
      display: flex;
      align-items: center;
    }

    .balance {
      font-size: 18px;
      margin-right: 10px;
      display: flex;
      align-items: center;
    }

    .balance .currency {
      font-weight: normal;
      margin-right: 5px;
      font-size: 10px;
    }

    .balance .amount {
      font-family: 'Peace Sans', sans-serif;
      font-weight: 900;
    }

    .skeleton-loader {
      background-color: #e0e0e0;
      width: 60px;
      height: 18px;
      border-radius: 4px;
      animation: skeleton-loading 1.2s infinite;
    }

    @keyframes skeleton-loading {
      0% { background-color: #e0e0e0; }
      50% { background-color: #f0f0f0; }
      100% { background-color: #e0e0e0; }
    }

    .balance-container img {
      width: 19px;
      height: 15px;
      cursor: pointer;
      margin-left: 7px;
      transition: opacity 0.3s ease;
    }

    .balance-container img:active {
      opacity: 0.3;
    }

    .floating-button button {
      background-color: transparent;
      border: 1px solid white;
      color: white;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.3s ease;
    }

    .floating-button button:active {
      opacity: 0.2;
    }

    .action-buttons {
      display: flex;
      justify-content: space-around;
      margin: 25px 20px 10px;
      gap: 16px;
    }

    .action-button {
      background-color: white;
      color: #1A7EB1;
      border: none;
      border-radius: 16px;
      padding: 14px 20px;
      flex: 1;
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .action-button:hover {
      transform: translateY(-2px);
    }

    .action-button:active {
      transform: scale(0.98);
    }

    .action-button i {
      color: #1A7EB1;
    }

    .icon-button-row {
      display: flex;
      justify-content: space-around;
      gap: 10px;
      padding: 20px;
    }

    .icon-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      background-color: white;
      padding: 12px;
      border-radius: 16px;
      flex: 1;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      transition: transform 0.2s ease;
    }

    .icon-button:hover {
      transform: translateY(-2px);
    }

    .icon-button:active {
      transform: scale(0.97);
    }

    .icon-button i {
      color: #1A7EB1;
      margin-bottom: 6px;
    }

    .icon-button span {
      font-size: 13px;
      color: #1A7EB1;
      font-weight: 500;
    }

    /* Luxury Total Gained Section */
    .monthly-gain {
      margin: 20px;
      padding: 5px;
      background: linear-gradient(135deg, #fff8e1, #f9d976);
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      text-align: center;
      transition: all 0.3s ease;
      border: 1px solid #f5deb3;
    }

    .monthly-gain:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
    }

    .monthly-gain h3 {
      color: #b68c26;
      font-size: 15px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .monthly-gain .amount {
      font-size: 20px;
      font-weight: bold;
      color: #3e2f13;
      font-family: 'Peace Sans', sans-serif;
      margin: 8px 0;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .monthly-gain .month {
      font-size: 14px;
      color: #7a6229;
      font-style: italic;
    }







.settings-section .header {
  background: linear-gradient(to right, #1A7EB1, #1A7EB1);
  color: white;
  padding: 15px;
  text-align: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
  box-sizing: border-box;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.settings-section .user-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
}

.settings-section .user-info h2 {
  margin: 5px 0;
  font-size: 20px;
  text-transform: uppercase;
  font-weight: 500;
}

.settings-section .user-info p {
  margin: 5px 0;
  font-size: 17px;
  line-height: 1.5;
  font-weight: 300;
  letter-spacing: 3px;
}

.settings-section .user-details {
  padding: 20px;
  background-color: #ffffff;
  margin-top: 190px;
  box-sizing: border-box;
  overflow-y: auto;
  height: calc(100vh - 180px - 100px);
}

.detail-item {
  padding: 15px 0;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: flex-start;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.detail-item:last-child {
  border-bottom: 1px solid #ddd;
}

.detail-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 100%;
  bottom: 0;
  right: 0;
  background: rgba(242, 242, 242, 0.7);
  transition: left 0.2s ease-out;
  z-index: 0;
}

.detail-item:active::before {
  left: 0;
}

.detail-item .info {
  display: flex;
  flex-direction: column;
}

.detail-item .label {
  font-size: 15px;
  font-weight: bold;
  color: #888;
  margin-bottom: 7px;
}

.detail-item .value {
  font-size: 14px;
  font-weight: 300;
  color: #555;
}

.detail-item:focus {
  outline: none;
}

.detail-item .icon {
  font-size: 16px;
  margin-right: 10px;
  color: #4a4a4a;
}

.detail-item .icon:hover {
  color: #007bff;
}

.detail-item .icon,
.detail-item .info {
  position: relative;
  z-index: 1;
}



    </style>
            </head>
            <body>

                <div id="content">
                    <!-- Home Section -->
                    <div id="home-section" class="section active">
                        <div class="app-container">
                            <div class="home-section">
                                <div class="header">
                                    <div class="header-left">
                                        <div class="user-icon">
                                            <i class="fas fa-user-circle"></i>
                                        </div>
                                        <div class="user-info">
                                            <h2 id="user-name">
                                                Hello, 
                                                <span id="dynamic-user-name">${userData.firstName}</span>
                                                <span class="material-icons" style="display: none;">verified</span>
                                            </h2>
                                            <p>Every Small Step Makes a Big Impact.</p>
                                        </div>
                                    </div>
                                    <div class="header-right">
                                        <a href="go:AB" aria-label="Notification">
                                            <i data-feather="bell" class="notification-icon"></i>
                                        </a>
                                    </div>
                                </div>

                                <div class="balance-wrapper">
                                    <div class="balance-container">
                                        <div id="balance" class="balance">
                                            <span class="currency">Balance:</span>
                                            <span id="balance-amount" class="amount">${userData.balance || 0}</span>
                                        </div>
                                        <i id="toggle-icon" class="material-icons" onclick="toggleBalance()">visibility</i>
                                    </div>
                                    <div class="floating-button">
                                        <button class="service" id="newTradingButton">Topup balance</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

  
  <div class="action-buttons">
    <button class="action-button" id="withdraw-button">
      <i data-feather="arrow-down-circle"></i>Withdraw
    </button>
    <button class="action-button">
      <i data-feather="send"></i>Send
    </button>
  </div>

  <div class="icon-button-row">
    <!-- Updated Activity button -->
    <a href="go:ACTIVITY" class="icon-button">
      <i data-feather="activity"></i>
      <span>Activity</span>
    </a>

    <!-- Referrals button now links to REFERRALS page -->
    <a href="go:REFERRALS" class="icon-button"> <!-- Link to REFERRALS page -->
      <i data-feather="users"></i>
      <span>Referrals</span>
    </a>

    <div class="icon-button">
      <i data-feather="dollar-sign"></i>
      <span>USD Wallet</span>
    </div>
  </div>

  <div class="monthly-gain">
    <h3>Total Gained</h3>
    <div class="amount">---</div>
    <div class="month">---</div>
  </div>
</div>
</div>
</div>
</div>
</div>


                    </div>
                            

                    <div id="chat-section" class="section" style="display: none;">
                        <div class="app-container">
                            <header>Support</header>
                            <div class="content">
                                <a href="go:CHAT" class="support-link">
                                    <div class="support-container">
                                        <div class="support-circle">C</div>
                                        <div class="support-text">
                                            <p>CHAT WITH US</p>
                                            <p>Tap here to text us</p>
                                        </div>
                                        <i class="fas fa-chevron-right support-icon"></i>
                                    </div>
                                </a>
                                <a href="https://t.me/nexussupport20" class="support-link">
                                    <div class="support-container">
                                        <div class="support-circle">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" class="support-circle-icon">
                                        </div>
                                        <div class="support-text">
                                            <p>TELEGRAM</p>
                                            <p>Tap here to message us</p>
                                        </div>
                                        <i class="fas fa-chevron-right support-icon"></i>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div id="games-section" class="section" style="display: none;">
                        <div class="app-container">
                            <header>GAMES</header>
                            <div class="content">
                                <div class="game-image-container">
                                    <a href="go:FRUITS">
                                        <img src="https://i.postimg.cc/9fM5XKcp/c60cacec-e353-4a9e-947a-fa2fec50bbd1.png" alt="Casino Machine 1" />
                                        <div class="game-name">FRUITS</div>
                                    </a>

                                    <a href="go:LUCKY3">
                                        <img src="https://i.postimg.cc/Xqng4SbN/70d8c0d0-c934-476f-a937-f17aa570e254.png" alt="Casino Machine 2" />
                                        <div class="game-name">LUCKY3</div>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="investments-section" class="section" style="display: none;">
                        <header>Investments</header>
                        <div class="content">
                            <div class="top-info">
                                <div class="info-box"><h4>Invested</h4><p id="investedAmount">---</p></div>
                                <div class="info-box"><h4>Profits</h4><p id="profitAmount">---</p></div>
                            </div>
                            <p id="countdownTimer" class="countdown-text"></p>
                            <div class="circle-wrapper">
                                <span id="planLabel">---</span>
                                <div class="circle" id="progressCircle">
                                    <div class="circle-inner">
                                        <h5>Daily Payout</h5>
                                        <p id="earningAmount">---</p>
                                    </div>
                                </div>
                                <span class="label-text">---</span>
                            </div>

                            <div class="buttons">
                                <button id="investButton"><i class="fas fa-plus-circle"></i> Invest</button>
                                <button id="stopInvestmentButton"><i class="fas fa-stop-circle"></i> Stop Investment</button>
                                <button id="cashOutButton"><i class="fas fa-coins"></i> Cashout</button>
                            </div>

                            <div class="info-text">
                                To withdraw your capital from investment press Stop Investment. 
                            </div>

                            <div class="section-title">Transaction History</div>
                            <div class="transaction-cards" id="transactionCards"></div>
                        </div>
                    </div>

                    <div id="settings-section" class="section" style="display: none;">
                        <div class="settings-section">
                            <div class="header">
                                <i class="fas fa-user-circle" style="font-size: 6rem; color: white;"></i>
                                <div class="user-info">
                                    <h2 id="full-name">${userData.firstName} ${userData.lastName}</h2>
                                    <p id="phone-number">${userData.phoneNumber}</p>
                                </div>
                            </div>

                            <div class="user-details">
                                <div class="detail-item">
                                    <i class="fas fa-id-card icon"></i>
                                    <div class="info">
                                        <span class="label">User ID</span>
                                        <span id="user-id">${req.session.userId}</span>
                                    </div>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-envelope icon"></i>
                                    <div class="info">
                                        <span class="label">Email</span>
                                        <span id="email-address">${userData.email || 'Not set'}</span>
                                    </div>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-user-check icon"></i>
                                    <div class="info">
                                        <span class="label">KYC Status</span>
                                        <span id="kyc-status">${userData.kyc || 'Pending'}</span>
                                    </div>
                                </div>
                                <div class="detail-item" id="logoutSection">
                                    <i class="fas fa-sign-out-alt icon"></i>
                                    <div class="info">
                                        <span class="label">Account</span>
                                        <a href="/api/logout" class="value">Sign out</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bottom-nav">
                    <div class="nav-items-wrapper">
                        <div class="nav-item home active" onclick="switchSection('home')">
                            <i class="fas fa-home"></i>
                            <p>Home</p>
                        </div>
                        <div class="nav-item chat" onclick="switchSection('chat')">
                            <i class="fas fa-headset"></i>
                            <p>Support</p>
                        </div>
                        <div class="nav-item games" onclick="switchSection('games')">
                            <i class="fas fa-gamepad"></i>
                            <p>Games</p>
                        </div>
                        <div class="nav-item investments" onclick="switchSection('investments')">
                            <i class="fas fa-chart-line"></i>
                            <p>Investments</p>
                        </div>
                        <div class="nav-item settings" onclick="switchSection('settings')">
                            <i class="fas fa-cogs"></i>
                            <p>Settings</p>
                        </div>
                    </div>
                </div>

                <script>
                    function switchSection(section) {
                        document.querySelectorAll('.section').forEach(sec => sec.style.display = 'none');
                        document.getElementById(section + '-section').style.display = 'block';
                        
                        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                        document.querySelector('.nav-item.' + section).classList.add('active');
                    }

                    function toggleBalance() {
    const balanceAmount = document.getElementById('balance-amount');
    const balancePlaceholder = document.getElementById('balance-placeholder');

    // If balance is hidden (placeholder is visible), show the actual balance and hide the placeholder
    if (balanceAmount.style.display === 'none') {
        balanceAmount.style.display = 'inline';
        balancePlaceholder.style.display = 'none';
    } else {
        // If balance is visible, hide it and show the placeholder
        balanceAmount.style.display = 'none';
        balancePlaceholder.style.display = 'inline';
    }
}
                </script>

            </body>
            </html>
        `);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Dashboard error');
    }
});



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
