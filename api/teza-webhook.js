import { db } from '../firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference_id, status, transaction_id } = req.body;

  // Log the webhook data for debugging purposes
  console.log("Webhook received:", req.body);

  // Reference to the user's data in Firebase
  const userId = reference_id.split('-')[1]; // Extracting userId from the reference
  const userRef = db.ref(`users/${userId}`);

  // Fetch the current user data from Firebase
  const snapshot = await userRef.once('value');
  const userData = snapshot.val();

  if (!userData) {
    console.log(`User ${userId} not found in database`);
    return res.status(404).json({ error: 'User not found' });
  }

  // Reference to the user's transactions
  const transactionsRef = userRef.child('transactions');

  // Find the transaction by reference_id (using 'reference' field)
  const transactionSnapshot = await transactionsRef
    .orderByChild('reference')
    .equalTo(reference_id) // Look for the transaction using the reference field
    .once('value');

  if (!transactionSnapshot.exists()) {
    console.log(`Transaction with reference ${reference_id} not found in user's transactions.`);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const transactionKey = Object.keys(transactionSnapshot.val())[0]; // Get the first match
  const transaction = transactionSnapshot.val()[transactionKey];

  // Handle Approved status
  if (status === 'Approved') {
    let newBalance = userData.balance || 0;
    const amount = transaction.amount;  // Fetch the amount from the database transaction

    // Handle credit or debit based on the reason of the transaction
    if (transaction.reason === 'Top Up') {
      newBalance += amount;  // Credit amount if reason is 'Top Up'
      console.log(`Transaction with reference ${reference_id} approved, credited UGX ${amount} to user ${userId}.`);
    } 
    // Withdrawal is not handled here because the deduction is already done in the server side before Teza request
    else if (transaction.reason === 'Withdraw') {
      // No deduction here, as it's handled earlier
      console.log(`Transaction with reference ${reference_id} approved for Withdrawal, no deduction needed.`);
    }

    // Update the user's balance in the database
    await userRef.update({
      balance: newBalance,
    });

    // Update the transaction status to 'completed'
    await transactionsRef.child(transactionKey).update({
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    console.log(`New balance for user ${userId}: UGX ${newBalance}`);

  } else if (status === 'Failed') {
    const amount = transaction.amount;  // Fetch the amount from the database transaction

    // If the transaction reason is 'Withdraw', credit the user back (refund)
    if (transaction.reason === 'Withdraw') {
      let newBalance = userData.balance || 0;
      newBalance += amount;  // Credit the amount back to the user

      // Update the user's balance in the database
      await userRef.update({
        balance: newBalance,
      });

      console.log(`Transaction with reference ${reference_id} failed, refunded UGX ${amount} back to user ${userId}.`);
    }

    // Mark the transaction as failed
    await transactionsRef.child(transactionKey).update({
      status: 'failed',
      timestamp: new Date().toISOString(),
    });

    console.log(`Transaction with reference ${reference_id} failed.`);
  }

  // Acknowledge receipt of the webhook
  res.status(200).json({ status: "received" });
}
