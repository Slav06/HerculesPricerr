// Stripe PaymentIntent — charge a card immediately
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

    const { amount, paymentMethodId, jobNumber, customerName } = body;
    if (!amount || !paymentMethodId) {
      return res.status(400).json({ success: false, error: 'amount and paymentMethodId are required' });
    }

    const amountCents = Math.round(parseFloat(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      description: `Job ${jobNumber || ''} — ${customerName || ''}`,
      metadata: { job_number: jobNumber || '', customer_name: customerName || '' },
      return_url: 'https://herculesmovingsolutions.com/dashboard',
    });

    return res.status(200).json({
      success: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      amount,
    });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
};
