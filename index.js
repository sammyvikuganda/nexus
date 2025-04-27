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

const publicKey = process.env.TEZA_PUBLIC_KEY;
const secretKey = process.env.TEZA_SECRET_KEY;



app.use(cors());
app.use(express.json());


app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));


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
