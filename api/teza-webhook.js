export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  // Log or store the webhook payload
  console.log("Webhook received:", data);

  // Respond to TezaNetwork to acknowledge receipt
  res.status(200).json({ status: "received" });
}
