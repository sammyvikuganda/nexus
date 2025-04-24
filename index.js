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
    const { phoneNumber, country, firstName, lastName, dob, nin, email, sponsorCode, pin, deviceDetails } = req.body;

    try {
        // Check for existing user details, including device information
        const { credentialsExist, deviceExists } = await checkIfExists(phoneNumber, email, nin, deviceDetails);

        // If both credentials and device details exist, send the appropriate message
        if (credentialsExist && deviceExists) {
            return res.status(400).json({
                message: 'Some of the credentials you provided are already registered, and you cannot register another account using this device. We only accept one account per device.'
            });
        }

        // If only credentials exist
        if (credentialsExist) {
            return res.status(400).json({
                message: 'Some of the credentials you provided already exist. If you have registered previously, please log in to your account.'
            });
        }

        // If only device details exist
        if (deviceExists) {
            return res.status(400).json({
                message: 'You cannot register another account using this device. We only accept one account per device.'
            });
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
            }, // Initialize paymentMethods with all options empty
            deviceDetails: {
                userAgent: deviceDetails?.userAgent || null,
                platform: deviceDetails?.platform || null,
                screenWidth: deviceDetails?.screenWidth || null,
                screenHeight: deviceDetails?.screenHeight || null,
                colorDepth: deviceDetails?.colorDepth || null,
                devicePixelRatio: deviceDetails?.devicePixelRatio || null
            } // Save device details
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



// Endpoint to handle both Top Up and Withdraw
app.patch('/api/update-balance', async (req, res) => {
  const { userId, amount, reason, phone } = req.body;

  if (!userId || amount === undefined || !reason || !phone) {
    return res.status(400).json({ message: 'User ID, amount, reason, and phone are required' });
  }

  try {
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = snapshot.val();
    const currentBalance = user.balance || 0;
    const sponsorCode = user.sponsorCode || null; // Sponsor code (which is the userId of the person who referred)
    const reference = `ref-${userId}-${Date.now()}`;
    const transactionsRef = userRef.child('transactions');

    // Sanitize phone number for Teza
    const formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');

    let tezaApiUrl = '';
    let tezaApiData = {
      apikey: publicKey,
      reference: reference,
      phone: formattedPhone,
      amount: amount,
      description: `${reason} request for user: ${userId}`
    };

    // Declare the company data fields
    let companyTax = 0;
    let companyCollection = 0;
    let sponsorCommission = 0;

    // Withdrawal: Check balance before submission
    if (reason === 'Withdraw') {
      if (currentBalance < amount) {
        return res.status(400).json({ message: 'Insufficient balance for withdrawal' });
      }

      // Deduct 10% (8% company tax + 2% referral commission)
      const amountToSend = amount * 0.9;
      tezaApiData.amount = amountToSend;
      tezaApiUrl = 'https://tezanetwork.com/api/v1/withdraw';

      // Calculate company tax (8%) and referral commission (2%)
      companyTax = amount * 0.08;

      if (sponsorCode) {
        // If sponsor code exists, credit the sponsor with 2% referral commission
        const sponsorRef = db.ref(`users/${sponsorCode}`);
        const sponsorSnapshot = await sponsorRef.once('value');

        if (sponsorSnapshot.exists()) {
          sponsorCommission = amount * 0.02;
        }
      } else {
        // If no sponsor code, give 2% to the company collection
        companyCollection = amount * 0.02;
      }

      // Save only companyTax and companyCollection in companyData
      const companyRef = db.ref('companyData');
      await companyRef.set({
        companyTax,
        companyCollection
      });
    } else if (reason === 'Top Up') {
      tezaApiUrl = 'https://tezanetwork.com/api/v1/deposit';
    } else {
      return res.status(400).json({ message: 'Invalid reason. Must be "Withdraw" or "Top Up"' });
    }

    // Log transaction before Teza submission
    const newTransactionRef = transactionsRef.push();
    await newTransactionRef.set({
      amount: amount,
      reason: reason,
      transactionId: null, // Placeholder for transaction ID from Teza
      reference: reference,
      phone: phone,
      status: 'pending', // Initial status as 'pending'
      timestamp: new Date().toISOString()
    });

    // Submit to Teza
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
          // Deduct balance immediately for withdrawals
          if (reason === 'Withdraw') {
            const newBalance = currentBalance - amount;
            await userRef.update({ balance: newBalance });
          }

          // Update transaction with Teza transaction ID
          await newTransactionRef.update({ transactionId: transaction_id });

          // **Apply the referral commission only if Teza transaction is successful**
          if (sponsorCode) {
            const sponsorRef = db.ref(`users/${sponsorCode}`);
            const sponsorSnapshot = await sponsorRef.once('value');

            if (sponsorSnapshot.exists()) {
              // Update sponsor's referral commission
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






app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
