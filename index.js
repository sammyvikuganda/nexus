// Register user endpoint
app.post('/api/register', async (req, res) => {
    const { phoneNumber, country, firstName, lastName, dob, nin, email, pin, deviceDetails } = req.body;
    const sponsorId = req.query.sponsorid;

    // Detect if the request came from a form
    const isFormRequest = req.headers['content-type']?.includes('application/x-www-form-urlencoded');

    // Error modal HTML
    const errorModalHTML = (title, message) => `
        <div id="errorModal" style="display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 9999;">
            <div class="error-modal-content">
                <div id="errorTitle">${title}</div>
                <div id="errorMessage">${message}</div>
                <button id="errorModalCloseButton" onclick="document.getElementById('errorModal').style.display = 'none'">
                    Close
                </button>
            </div>
        </div>
        <style>
            .error-modal-content {
                margin: auto;
                padding: 15px;
                width: 70%;
                max-width: 350px;
                text-align: center;
                border-radius: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
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
        </style>
    `;

    try {
        const { credentialsExist, deviceExists } = await checkIfExists(phoneNumber, email, nin, deviceDetails);

        if (credentialsExist && deviceExists) {
            if (isFormRequest) {
                return res.send(errorModalHTML('Error', 'Some of the credentials you provided are already registered, and you cannot register another account using this device.'));
            } else {
                return res.status(400).json({
                    message: 'Some of the credentials you provided are already registered, and you cannot register another account using this device.'
                });
            }
        }

        if (credentialsExist) {
            if (isFormRequest) {
                return res.send(errorModalHTML('Error', 'Some of the credentials you provided already exist. If you have registered previously, please log in.'));
            } else {
                return res.status(400).json({
                    message: 'Some of the credentials you provided already exist. If you have registered previously, please log in.'
                });
            }
        }

        if (deviceExists) {
            if (isFormRequest) {
                return res.send(errorModalHTML('Error', 'You cannot register another account using this device.'));
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
            return res.send(errorModalHTML('Error', 'An unexpected error occurred while registering. Please try again later.'));
        } else {
            return res.status(500).json({
                message: 'Error registering user',
                error
            });
        }
    }
});
