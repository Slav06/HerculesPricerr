# Resend Email Setup

## 1. Get your API key

1. Sign up at [resend.com](https://resend.com).
2. Go to **API Keys** and create a key.
3. Copy the key (starts with `re_`).

## 2. Configure Vercel

In your Vercel project:

1. **Project → Settings → Environment Variables**
2. Add:
   - **`RESEND_API_KEY`** = your Resend API key (e.g. `re_xxxxx`)
   - **`RESEND_FROM`** (optional) = default "from" address, e.g. `Pricer <noreply@yourdomain.com>`
3. Redeploy so the serverless function picks up the new variables.

Until you verify a domain in Resend, you can send from `onboarding@resend.dev` (limited to your own email for testing).

## 3. Verify a domain (for production)

1. In Resend: **Domains → Add Domain**.
2. Add the DNS records they show (SPF, DKIM, etc.).
3. After verification, set **`RESEND_FROM`** to something like `Pricer <noreply@yourdomain.com>`.

## 4. Use in the dashboard

Include the config and service, then call the API:

```html
<script src="resend-config.js"></script>
<script src="email-service.js"></script>
<script>
  const emailService = new EmailService();

  // Plain email
  emailService.send('client@example.com', 'Your quote', {
    html: '<p>Hi, here is your quote...</p>'
  }).then(r => console.log(r));

  // With a Resend template (create template in Resend Dashboard first)
  emailService.sendTemplate('client@example.com', 'd_xxxxxx', {
    CUSTOMER_NAME: 'John',
    JOB_NUMBER: '123',
    QUOTE_AMOUNT: '$500'
  }).then(r => console.log(r));

  // Convenience helpers
  emailService.sendQuote('client@example.com', {
    customerName: 'John',
    jobNumber: '123',
    quoteAmount: '$500',
    validUntil: '2025-03-01'
  });
  emailService.sendPayment('client@example.com', {
    customerName: 'John',
    jobNumber: '123',
    amount: '$200',
    paymentLink: 'https://...'
  });
</script>
```

## 5. Test your domain

After verifying your domain and setting `RESEND_FROM` in Vercel:

1. **From the dashboard:** Log in as admin → **Email** tab → click **Open email test page**.
2. **Direct URL:** Open `/email-test` or `email-test.html` (e.g. `https://yourdomain.com/email-test`).
3. Enter your email, optionally change subject/body, then click **Send test email**.

Success means Resend and your domain are working.

## 6. Templates in Resend

1. Resend Dashboard → **Templates** → Create.
2. Use variables like `{{{CUSTOMER_NAME}}}`, `{{{JOB_NUMBER}}}` in the HTML.
3. Copy the template ID and add it to `resend-config.js` under `templates.quote`, `templates.payment`, etc.

## API endpoint (reference)

- **POST** `/api/send-email`
- Body (plain): `{ "to": "a@b.com", "subject": "...", "html": "..." }`
- Body (template): `{ "to": "a@b.com", "templateId": "d_xxx", "templateVariables": { "NAME": "..." } }`
- Optional: `from`, `replyTo`, `text`

The API key is only used on the server (env var); never send it from the browser.
