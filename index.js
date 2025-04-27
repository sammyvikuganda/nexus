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
                // Instead of redirecting, show a success page with the user's name
                if (isFormRequest) {
                    return res.send(`
                        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Nexus - Earn Online</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #7c4dff;  /* Elegant purple */
            --primary-dark: #651fff;
            --telegram: #0088cc;
            --success: #00bfa5;  /* Teal accent */
            --earn: #ffab00;    /* Golden yellow */
            --text: #263238;    /* Dark blue-gray */
            --text-light: #607d8b;
            --bg: #f5f7fa;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        body {
            min-height: 100vh;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            position: relative;
        }

        /* Elegant floating circles background */
        .bg-circles {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            overflow: hidden;
        }
        
        .bg-circles li {
            position: absolute;
            display: block;
            list-style: none;
            width: 20px;
            height: 20px;
            background: rgba(124, 77, 255, 0.1);
            border-radius: 50%;
            animation: float 15s linear infinite;
            bottom: -150px;
        }
        
        .bg-circles li:nth-child(1) {
            left: 25%;
            width: 80px;
            height: 80px;
            animation-delay: 0s;
            background: rgba(0, 191, 165, 0.1);
        }
        
        .bg-circles li:nth-child(2) {
            left: 10%;
            width: 20px;
            height: 20px;
            animation-delay: 2s;
            animation-duration: 12s;
        }
        
        .bg-circles li:nth-child(3) {
            left: 70%;
            width: 20px;
            height: 20px;
            animation-delay: 4s;
        }
        
        .bg-circles li:nth-child(4) {
            left: 40%;
            width: 60px;
            height: 60px;
            animation-delay: 0s;
            animation-duration: 18s;
            background: rgba(255, 171, 0, 0.1);
        }
        
        .bg-circles li:nth-child(5) {
            left: 65%;
            width: 20px;
            height: 20px;
            animation-delay: 0s;
        }
        
        .bg-circles li:nth-child(6) {
            left: 75%;
            width: 110px;
            height: 110px;
            animation-delay: 3s;
            background: rgba(124, 77, 255, 0.1);
        }
        
        .bg-circles li:nth-child(7) {
            left: 35%;
            width: 150px;
            height: 150px;
            animation-delay: 7s;
            background: rgba(0, 191, 165, 0.1);
        }
        
        .bg-circles li:nth-child(8) {
            left: 50%;
            width: 25px;
            height: 25px;
            animation-delay: 15s;
            animation-duration: 45s;
        }
        
        .bg-circles li:nth-child(9) {
            left: 20%;
            width: 15px;
            height: 15px;
            animation-delay: 2s;
            animation-duration: 35s;
            background: rgba(255, 171, 0, 0.1);
        }
        
        .bg-circles li:nth-child(10) {
            left: 85%;
            width: 150px;
            height: 150px;
            animation-delay: 0s;
            animation-duration: 11s;
        }

        @keyframes float {
            0% {
                transform: translateY(0) rotate(0deg);
                opacity: 1;
                border-radius: 50%;
            }
            100% {
                transform: translateY(-1000px) rotate(720deg);
                opacity: 0;
                border-radius: 50%;
            }
        }

        .content-wrapper {
            background: white;
            border-radius: 16px;
            padding: 2rem;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 15px 30px rgba(124, 77, 255, 0.1);
            animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid rgba(124, 77, 255, 0.1);
        }
        
        .success-notification {
            text-align: center;
            margin-bottom: 1.5rem;
            width: 100%;
        }
        
        .icon-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .success-icon {
            font-size: 2.8rem;
            color: var(--success);
            display: inline-flex;
            justify-content: center;
            align-items: center;
            width: 80px;
            height: 80px;
            background: rgba(0, 191, 165, 0.1);
            border-radius: 50%;
            box-shadow: 0 8px 24px rgba(0, 191, 165, 0.2);
            animation: pulse 2s infinite;
            margin-bottom: 0.8rem;
        }
        
        .platform-badge {
            display: inline-block;
            background: rgba(255, 171, 0, 0.15);
            color: var(--earn);
            padding: 0.4rem 1rem;
            border-radius: 50px;
            font-size: 0.75rem;
            font-weight: 600;
            border: 1px solid rgba(255, 171, 0, 0.2);
            box-shadow: 0 2px 8px rgba(255, 171, 0, 0.1);
        }
        
        .success-content h3 {
            margin: 0 0 0.6rem 0;
            font-size: 1.6rem;
            font-weight: 800;
            color: var(--text);
            letter-spacing: -0.5px;
            background: linear-gradient(90deg, #7c4dff, #00bfa5);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        
        .success-messages {
            font-size: 0.9rem;
            line-height: 1.6;
            color: var(--text-light);
        }
        
        .success-messages p {
            margin: 0.5rem 0;
        }
        
        .earn-highlight {
            color: var(--earn);
            font-weight: 600;
        }
        
        .download-options {
            text-align: center;
            width: 100%;
            margin-top: 1.5rem;
        }
        
        .download-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 1.25rem;
            letter-spacing: -0.5px;
        }
        
        .download-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            padding: 0.9rem;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            margin: 0.5rem 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            width: 100%;
            font-size: 0.9rem;
            box-shadow: 0 6px 20px rgba(124, 77, 255, 0.2);
            border: none;
            position: relative;
            overflow: hidden;
        }
        
        .download-btn::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                      rgba(255,255,255,0) 0%, 
                      rgba(255,255,255,0.2) 50%, 
                      rgba(255,255,255,0) 100%);
            transform: translateX(-100%);
        }
        
        .download-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 28px rgba(124, 77, 255, 0.3);
        }
        
        .download-btn:hover::after {
            animation: shine 1.5s infinite;
        }
        
        .download-btn i {
            font-size: 1.2rem;
            margin-right: 0.8rem;
        }
        
        .divider {
            margin: 1rem 0;
            color: var(--text-light);
            display: flex;
            align-items: center;
            font-size: 0.8rem;
            font-weight: 500;
        }
        
        .divider::before,
        .divider::after {
            content: "";
            flex: 1;
            border-bottom: 1px solid rgba(96, 125, 139, 0.15);
        }
        
        .divider::before {
            margin-right: 0.8rem;
        }
        
        .divider::after {
            margin-left: 0.8rem;
        }
        
        footer {
            text-align: center;
            margin-top: 1.5rem;
            color: var(--text-light);
            font-size: 0.75rem;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        @keyframes shine {
            100% { transform: translateX(100%); }
        }
    </style>
</head>
<body>
    <div class="bg-circles">
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
    </div>
    
    <div class="content-wrapper">
        <div class="success-notification">
            <div class="icon-container">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="platform-badge">
                    <i class="fas fa-coins"></i> Online Money Platform
                </div>
            </div>
            <div class="success-content">
                <h3>Registration Successful!</h3>
                <div class="success-messages">
                    <p>Welcome ${firstName} ${lastName}, your account is ready! Download the app to start your <span class="earn-highlight">earning journey</span> today.</p>
                </div>
            </div>
        </div>
        
        <div class="download-options">
            <h2 class="download-title">Start Earning Now</h2>
            
            <a href="https://apk.e-droid.net/apk/app3402371-3q8gkl.apk?v=3" class="download-btn" download>
                <i class="fas fa-download"></i>
                Download Nexus App
            </a>
            
            <div class="divider">OR</div>
            
            <a href="https://t.me/yourtelegramgroup" class="download-btn" style="background: linear-gradient(135deg, var(--telegram), #0077b5); box-shadow: 0 6px 20px rgba(0, 136, 204, 0.2);">
                <i class="fab fa-telegram"></i>
                Join Telegram Group
            </a>
        </div>
        
        <footer>
            <p>© 2023 Nexus - Online Money Earning Platform. All rights reserved</p>
        </footer>
    </div>
</body>
</html>
                    `);
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







app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nexus - Online Earning Platform</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        :root {
          --primary: #6366f1;
          --primary-dark: #4f46e5;
          --dark: #1e293b;
          --light: #f8fafc;
          --gray: #94a3b8;
          --success: #10b981;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          background-color: #f1f5f9;
          color: var(--dark);
          line-height: 1.6;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }
        
        header {
          background-color: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
        }
        
        .logo {
          font-size: 24px;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .logo i {
          font-size: 28px;
        }
        
        .nav-links {
          display: flex;
          gap: 30px;
        }
        
        .nav-links a {
          text-decoration: none;
          color: var(--dark);
          font-weight: 500;
          transition: color 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .nav-links a:hover {
          color: var(--primary);
        }
        
        .nav-links a i {
          font-size: 14px;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.3s;
          cursor: pointer;
        }
        
        .btn i {
          font-size: 14px;
        }
        
        .btn-primary {
          background-color: var(--primary);
          color: white;
        }
        
        .btn-primary:hover {
          background-color: var(--primary-dark);
          transform: translateY(-2px);
        }
        
        .btn-outline {
          border: 1px solid var(--primary);
          color: var(--primary);
        }
        
        .btn-outline:hover {
          background-color: var(--primary);
          color: white;
          transform: translateY(-2px);
        }
        
        .hero {
          padding: 100px 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        
        .hero::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(255,255,255,0) 70%);
          z-index: -1;
        }
        
        .hero h1 {
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 20px;
          background: linear-gradient(to right, var(--primary), var(--success));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .hero p {
          font-size: 20px;
          color: var(--gray);
          max-width: 700px;
          margin: 0 auto 40px;
        }
        
        .cta-buttons {
          display: flex;
          gap: 15px;
          justify-content: center;
        }
        
        .stats {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-top: 60px;
          flex-wrap: wrap;
        }
        
        .stat-item {
          text-align: center;
        }
        
        .stat-number {
          font-size: 40px;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 5px;
        }
        
        .stat-label {
          color: var(--gray);
          font-size: 14px;
        }
        
        .features {
          padding: 80px 0;
          background-color: white;
        }
        
        .section-title {
          text-align: center;
          margin-bottom: 50px;
        }
        
        .section-title h2 {
          font-size: 36px;
          margin-bottom: 15px;
        }
        
        .section-title p {
          color: var(--gray);
          max-width: 600px;
          margin: 0 auto;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
        }
        
        .feature-card {
          background-color: var(--light);
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 15px rgba(0,0,0,0.1);
        }
        
        .feature-icon {
          width: 60px;
          height: 60px;
          background-color: rgba(99,102,241,0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: var(--primary);
          font-size: 24px;
        }
        
        .feature-card h3 {
          font-size: 20px;
          margin-bottom: 15px;
        }
        
        .feature-card p {
          color: var(--gray);
        }
        
        .cta-section {
          padding: 80px 0;
          background-color: var(--primary);
          color: white;
          text-align: center;
        }
        
        .cta-section h2 {
          font-size: 36px;
          margin-bottom: 20px;
        }
        
        .cta-section p {
          max-width: 600px;
          margin: 0 auto 30px;
          opacity: 0.9;
        }
        
        footer {
          background-color: var(--dark);
          color: white;
          padding: 60px 0 20px;
        }
        
        .footer-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 40px;
          margin-bottom: 40px;
        }
        
        .footer-column h3 {
          font-size: 18px;
          margin-bottom: 20px;
          color: var(--light);
        }
        
        .footer-column ul {
          list-style: none;
        }
        
        .footer-column ul li {
          margin-bottom: 10px;
        }
        
        .footer-column ul li a {
          color: var(--gray);
          text-decoration: none;
          transition: color 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .footer-column ul li a i {
          font-size: 14px;
          width: 20px;
        }
        
        .footer-column ul li a:hover {
          color: white;
        }
        
        .social-links {
          display: flex;
          gap: 15px;
          margin-top: 20px;
        }
        
        .social-links a {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.3s;
        }
        
        .social-links a:hover {
          background-color: var(--primary);
          transform: translateY(-3px);
        }
        
        .copyright {
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.1);
          color: var(--gray);
          font-size: 14px;
        }
        
        @media (max-width: 768px) {
          .nav-links {
            display: none;
          }
          
          .hero h1 {
            font-size: 36px;
          }
          
          .hero p {
            font-size: 18px;
          }
          
          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }
          
          .stats {
            gap: 20px;
          }
          
          .stat-number {
            font-size: 30px;
          }
        }
      </style>
    </head>
    <body>
      <header>
        <div class="container">
          <nav>
            <a href="/" class="logo">
              <i class="fas fa-bolt"></i>
              <span>Nexus</span>
            </a>
            <div class="nav-links">
              <a href="#features">
                <i class="fas fa-star"></i>
                <span>Features</span>
              </a>
              <a href="#how-it-works">
                <i class="fas fa-play-circle"></i>
                <span>How It Works</span>
              </a>
              <a href="#about">
                <i class="fas fa-info-circle"></i>
                <span>About</span>
              </a>
            </div>
            <a href="#" class="btn btn-outline">
              <i class="fas fa-sign-in-alt"></i>
              <span>Sign In</span>
            </a>
          </nav>
        </div>
      </header>
      
      <main>
        <section class="hero">
          <div class="container">
            <h1>Earn Online with Nexus</h1>
            <p>Join thousands of users earning money through our innovative platform. Whether you're freelancing, selling digital products, or completing tasks, Nexus provides the tools you need to succeed.</p>
            <div class="cta-buttons">
              <a href="#" class="btn btn-primary">
                <i class="fas fa-rocket"></i>
                <span>Get Started</span>
              </a>
              <a href="#" class="btn btn-outline">
                <i class="fas fa-play"></i>
                <span>Watch Demo</span>
              </a>
            </div>
            
            <div class="stats">
              <div class="stat-item">
                <div class="stat-number">50K+</div>
                <div class="stat-label">Active Users</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">$10M+</div>
                <div class="stat-label">Earned</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">120+</div>
                <div class="stat-label">Countries</div>
              </div>
            </div>
          </div>
        </section>
        
        <section id="features" class="features">
          <div class="container">
            <div class="section-title">
              <h2>Why Choose Nexus?</h2>
              <p>Our platform offers everything you need to start earning online quickly and securely.</p>
            </div>
            
            <div class="features-grid">
              <div class="feature-card">
                <div class="feature-icon">
                  <i class="fas fa-money-bill-wave"></i>
                </div>
                <h3>Fast Payments</h3>
                <p>Get paid quickly with our reliable payment system that supports multiple withdrawal methods.</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">
                  <i class="fas fa-chart-line"></i>
                </div>
                <h3>Growth Tools</h3>
                <p>Access analytics and marketing tools to help grow your online business.</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">
                  <i class="fas fa-shield-alt"></i>
                </div>
                <h3>Secure Platform</h3>
                <p>Your data and earnings are protected with bank-level security measures.</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">
                  <i class="fas fa-globe"></i>
                </div>
                <h3>Global Reach</h3>
                <p>Connect with clients and customers from around the world.</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">
                  <i class="fas fa-stream"></i>
                </div>
                <h3>Multiple Streams</h3>
                <p>Diversify your income with various earning opportunities in one platform.</p>
              </div>
              
              <div class="feature-card">
                <div class="feature-icon">
                  <i class="fas fa-mobile-alt"></i>
                </div>
                <h3>Mobile Friendly</h3>
                <p>Manage your earnings on the go with our fully responsive platform.</p>
              </div>
            </div>
          </div>
        </section>
        
        <section class="cta-section">
          <div class="container">
            <h2>Ready to Start Earning?</h2>
            <p>Join Nexus today and unlock your online earning potential. It only takes a few minutes to get started.</p>
            <a href="#" class="btn btn-primary" style="background-color: white; color: var(--primary);">
              <i class="fas fa-user-plus"></i>
              <span>Create Free Account</span>
            </a>
          </div>
        </section>
      </main>
      
      <footer>
        <div class="container">
          <div class="footer-content">
            <div class="footer-column">
              <h3>Nexus</h3>
              <p>The premier platform for online earning opportunities.</p>
              <div class="social-links">
                <a href="#"><i class="fab fa-twitter"></i></a>
                <a href="#"><i class="fab fa-facebook-f"></i></a>
                <a href="#"><i class="fab fa-instagram"></i></a>
                <a href="#"><i class="fab fa-linkedin-in"></i></a>
              </div>
            </div>
            
            <div class="footer-column">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Home</a></li>
                <li><a href="#features"><i class="fas fa-chevron-right"></i> Features</a></li>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Blog</a></li>
              </ul>
            </div>
            
            <div class="footer-column">
              <h3>Resources</h3>
              <ul>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Help Center</a></li>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Community</a></li>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Tutorials</a></li>
              </ul>
            </div>
            
            <div class="footer-column">
              <h3>Legal</h3>
              <ul>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Privacy Policy</a></li>
                <li><a href="#"><i class="fas fa-chevron-right"></i> Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div class="copyright">
            <p>© ${new Date().getFullYear()} Nexus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </body>
    </html>
  `);
});


app.use((req, res) => {
  res.status(404).send(`
    <html>
      <head>
        <title>Page Not Found</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
          }
          h1 {
            font-size: 50px;
          }
          p {
            font-size: 20px;
          }
          a {
            text-decoration: none;
            color: #007BFF;
          }
        </style>
      </head>
      <body>
        <h1>Oops!</h1>
        <p>The page you're looking for is currently unavailable.</p>
        <p><a href="/">Go back Home</a></p>
      </body>
    </html>
  `);
});





app.get('/dashboard', (req, res) => {
    res.send(`
        <html>
        <body>
            <h2>User Dashboard</h2>
            <div id="balance">Loading balance...</div>

            <script>
                const userId = localStorage.getItem('userId');
                if (!userId) {
                    alert('No user ID found, please login.');
                    window.location.href = '/api/login';
                } else {
                    fetch('/api/user?userId=' + userId)
                        .then(response => response.json())
                        .then(data => {
                            document.getElementById('balance').innerText = "Your balance is: $" + data.balance;
                        })
                        .catch(error => {
                            console.error('Error fetching user data:', error);
                            document.getElementById('balance').innerText = 'Failed to load balance.';
                        });
                }
            </script>
        </body>
        </html>
    `);
});



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
