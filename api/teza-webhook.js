import { db } from '../firebaseAdmin';

// Function to find the transaction with retry and delay
async function findTransactionWithRetry(transactionsRef, reference_id, retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    const snapshot = await transactionsRef
      .orderByChild('reference')
      .equalTo(reference_id)
      .once('value');

    if (snapshot.exists()) {
      return snapshot;
    }

    // Wait for the specified delay before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // If not found after retries, return null
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference_id, status, transaction_id } = req.body;
  console.log("Webhook received:", req.body);

  const userId = reference_id.split('-')[1]; // Extract userId from reference
  const userRef = db.ref(`users/${userId}`);

  // Fetch user data from Firebase
  const snapshot = await userRef.once('value');
  const userData = snapshot.val();

  if (!userData) {
    console.log(`User ${userId} not found in database`);
    return res.status(404).json({ error: 'User not found' });
  }

  const transactionsRef = userRef.child('transactions');

  // Retry finding the transaction (in case it hasn't been written yet)
  const transactionSnapshot = await findTransactionWithRetry(transactionsRef, reference_id, 5, 1000);

  if (!transactionSnapshot) {
    console.log(`Transaction with reference ${reference_id} not found in user's transactions.`);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const transactionKey = Object.keys(transactionSnapshot.val())[0];
  const transaction = transactionSnapshot.val()[transactionKey];

  // Handle 'Approved' status
  if (status === 'Approved') {
    let newBalance = userData.balance || 0;
    const amount = transaction.amount;

    if (transaction.reason === 'Top Up') {
      newBalance += amount; // Credit amount if reason is 'Top Up'
      console.log(`Transaction with reference ${reference_id} approved, credited UGX ${amount} to user ${userId}.`);
    } else if (transaction.reason === 'Withdraw') {
      console.log(`Transaction with reference ${reference_id} approved for Withdrawal, no deduction needed.`);
    }

    // Update user's balance in the database
    await userRef.update({ balance: newBalance });

    // Update transaction status to 'completed'
    await transactionsRef.child(transactionKey).update({
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    console.log(`New balance for user ${userId}: UGX ${newBalance}`);
  } 
  // Handle 'Failed' status
  else if (status === 'Failed') {
    const amount = transaction.amount;

    if (transaction.reason === 'Withdraw') {
      let newBalance = userData.balance || 0;
      newBalance += amount; // Credit the user back if the transaction failed
      await userRef.update({ balance: newBalance });
      console.log(`Transaction with reference ${reference_id} failed, refunded UGX ${amount} back to user ${userId}.`);
    }

    // Mark transaction as 'failed'
    await transactionsRef.child(transactionKey).update({
      status: 'failed',
      timestamp: new Date().toISOString(),
    });

    console.log(`Transaction with reference ${reference_id} failed.`);
  }

  // Acknowledge receipt of the webhook
  res.status(200).json({ status: "received" });
}
