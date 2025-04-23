import { db } from '../firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reference_id, status, transaction_id } = req.body;

  console.log("Webhook received:", req.body);

  const userId = reference_id.split('-')[1];
  const userRef = db.ref(`users/${userId}`);

  const snapshot = await userRef.once('value');
  const userData = snapshot.val();

  if (!userData) {
    console.log(`User ${userId} not found in database`);
    return res.status(404).json({ error: 'User not found' });
  }

  const transactionsRef = userRef.child('transactions');

  const transactionSnapshot = await transactionsRef
    .orderByChild('reference')
    .equalTo(reference_id)
    .once('value');

  if (!transactionSnapshot.exists()) {
    console.log(`Transaction with reference ${reference_id} not found in user's transactions.`);

    const failedLogRef = userRef.child('failed_logs').push();
    await failedLogRef.set({
      userId,
      reference_id,
      transaction_id,
      status,
      message: `Transaction not found for reference ${reference_id}`,
      timestamp: new Date().toISOString()
    });

    return res.status(404).json({ error: 'Transaction not found' });
  }

  const transactionKey = Object.keys(transactionSnapshot.val())[0];
  const transaction = transactionSnapshot.val()[transactionKey];
  const amount = transaction.amount;
  let newBalance = userData.balance || 0;

  if (status === 'Approved') {
    if (transaction.reason === 'Top Up') {
      newBalance += amount;
      await userRef.update({ balance: newBalance });
      console.log(`Top Up approved: UGX ${amount} credited to user ${userId}`);
    }

    // No balance change for Withdraw on Approved since it was already deducted client-side
    if (transaction.reason === 'Withdraw') {
      console.log(`Withdraw approved: No balance change for user ${userId}, already deducted client-side.`);
    }

    await transactionsRef.child(transactionKey).update({
      status: 'completed',
      transaction_id,
      timestamp: new Date().toISOString(),
    });

  } else if (status === 'Failed') {
    if (transaction.reason === 'Withdraw') {
      newBalance += amount;
      await userRef.update({ balance: newBalance });
      console.log(`Withdraw failed: UGX ${amount} refunded to user ${userId}`);
    }

    await transactionsRef.child(transactionKey).update({
      status: 'failed',
      transaction_id,
      timestamp: new Date().toISOString(),
    });

    console.log(`Transaction with reference ${reference_id} marked as failed.`);
  }

  res.status(200).json({ status: "received" });
}
