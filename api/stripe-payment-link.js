// Stripe Payment Link — generates a hosted payment URL to send to customer
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

    const { amount, jobNumber, customerName } = body;
    if (!amount) return res.status(400).json({ success: false, error: 'amount is required' });

    const amountCents = Math.round(parseFloat(amount) * 100);

    const price = await stripe.prices.create({
      unit_amount: amountCents,
      currency: 'usd',
      product_data: {
        name: `Moving Service${jobNumber ? ' — Job ' + jobNumber : ''}`,
        ...(customerName ? { description: customerName } : {}),
      },
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { job_number: jobNumber || '', customer_name: customerName || '' },
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: { custom_message: 'Thank you! Your payment has been received by Hercules Moving Solutions.' },
      },
    });

    return res.status(200).json({ success: true, url: link.url, linkId: link.id });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
};
