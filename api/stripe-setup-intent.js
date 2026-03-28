// Stripe SetupIntent — saves a card on file for future off-session charges
const Stripe = require('stripe');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET);
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { jobNumber, customerName, customerEmail } = body;

    const customer = await stripe.customers.create({
      ...(customerName  ? { name: customerName }   : {}),
      ...(customerEmail ? { email: customerEmail } : {}),
      metadata: { job_number: jobNumber || '' },
    });

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
      metadata: { job_number: jobNumber || '' },
    });

    return res.status(200).json({
      success: true,
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
};
