export default (req, res) => {
  res.status(200).send(`
    <h1>Welcome to Nexus Server</h1>
    <p>Your webhook endpoint is <code>/api/teza-webhook</code>.</p>
  `);
};
