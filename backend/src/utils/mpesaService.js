/**
 * M-Pesa Daraja API (STK Push) service.
 * Requires these env vars — see .env.example:
 *   MPESA_ENV=sandbox|production
 *   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE, MPESA_PASSKEY
 *   MPESA_CALLBACK_URL  (public HTTPS URL Safaricom will POST to)
 */

function baseUrl() {
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function getAccessToken() {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error('MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET not configured');
  }

  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) throw new Error(`M-Pesa auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

/**
 * Initiates an STK push ("Lipa na M-Pesa Online") prompt on the payer's phone.
 * @param {object} params
 * @param {string} params.phone - format 2547XXXXXXXX (no +, no leading 0)
 * @param {number} params.amount
 * @param {string} params.accountReference - shows on the STK prompt (e.g. admission number)
 * @param {string} params.transactionDesc
 * @returns {Promise<object>} Daraja's response, including CheckoutRequestID
 */
async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const { MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL } = process.env;
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    throw new Error('MPESA_SHORTCODE / MPESA_PASSKEY / MPESA_CALLBACK_URL not configured');
  }

  const ts = timestamp();
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${ts}`).toString('base64');
  const accessToken = await getAccessToken();

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc || 'School fees',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.errorMessage || 'STK push request failed');
  return data;
}

module.exports = { initiateStkPush };