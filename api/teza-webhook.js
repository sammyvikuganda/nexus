import { db } from '../firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference_id, status, transaction_id } = req.body;

  // Log the webhook data for debugging purposes
  console.log("Webhook received:", req.body);

  // Parse the reference to extract userId and amount
  const parts = reference_id.split('-');
  const userId = parts[1];  // Extracting userId from the reference
  const amount = parseFloat(parts[2]);  // Extracting amount from the reference

  if (status === 'Approved') {
    // Reference to the user's balance field in Firebase
    const userRef = db.ref(`users/${userId}`);

    // Fetch the current balance of the user
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (userData) {
      // Calculate the new balance (existing balance + new amount)
      const newBalance = (userData.balance || 0) + amount;

      // Update the user's balance
      await userRef.update({
        balance: newBalance,
      });

      // Push the transaction data to the transactions field
      const transactionsRef = userRef.child('transactions');
      await transactionsRef.push({
        transactionId: transaction_id,
        amount: amount,
        status: 'completed',
        reason: 'Top Up',  // Add the reason here
        timestamp: new Date().toISOString()
      });

      console.log(`Credited UGX ${amount} to user ${userId}, new balance: UGX ${newBalance}`);
    } else {
      console.log(`User ${userId} not found in database`);
    }
  }

  // Acknowledge receipt of the webhook
  res.status(200).json({ status: "received" });
}
