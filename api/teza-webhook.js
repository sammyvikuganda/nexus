import { db } from '../firebaseAdmin';

async function findTransactionWithRetry(transactionsRef, reference_id, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    const snapshot = await transactionsRef
      .orderByChild('reference')
      .equalTo(reference_id)
      .once('value');

    if (snapshot.exists()) {
      return snapshot;
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return null;
}

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

  // Retry finding the transaction in case it hasn't been written yet
  const transactionSnapshot = await findTransactionWithRetry(transactionsRef, reference_id);

  if (!transactionSnapshot) {
    console.log(`Transaction with reference ${reference_id} not found in user's transactions.`);
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const transactionKey = Object.keys(transactionSnapshot.val())[0];
  const transaction = transactionSnapshot.val()[transactionKey];

  if (status === 'Approved') {
    let newBalance = userData.balance || 0;
    const amount = transaction.amount;

    if (transaction.reason === 'Top Up') {
      newBalance += amount;
      console.log(`Transaction with reference ${reference_id} approved, credited UGX ${amount} to user ${userId}.`);
    } else if (transaction.reason === 'Withdraw') {
      console.log(`Transaction with reference ${reference_id} approved for Withdrawal, no deduction needed.`);
    }

    await userRef.update({ balance: newBalance });

    await transactionsRef.child(transactionKey).update({
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    console.log(`New balance for user ${userId}: UGX ${newBalance}`);
  } else if (status === 'Failed') {
    const amount = transaction.amount;

    if (transaction.reason === 'Withdraw') {
      let newBalance = userData.balance || 0;
      newBalance += amount;
      await userRef.update({ balance: newBalance });
      console.log(`Transaction with reference ${reference_id} failed, refunded UGX ${amount} back to user ${userId}.`);
    }

    await transactionsRef.child(transactionKey).update({
      status: 'failed',
      timestamp: new Date().toISOString(),
    });

    console.log(`Transaction with reference ${reference_id} failed.`);
  }

  res.status(200).json({ status: "received" });
}
