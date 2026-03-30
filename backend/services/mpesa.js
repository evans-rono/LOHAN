// backend/services/mpesa.js
const axios = require('axios');

const MPESA_BASE_URL = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Get OAuth access token from Safaricom
async function getAccessToken() {
  const consumerKey    = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured. Add MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET to your .env file.');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}

// Initiate STK Push (Lipa Na M-Pesa Online)
async function initiateSTKPush({ phoneNumber, amount, reference, description }) {
  const accessToken = await getAccessToken();

  const shortcode  = process.env.MPESA_SHORTCODE;
  const passkey    = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/payments/mpesa-callback';

  if (!shortcode || !passkey) {
    throw new Error('M-Pesa shortcode or passkey not configured in .env');
  }

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  // Format phone number: remove + and ensure starts with 254
  let phone = phoneNumber.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (!phone.startsWith('254')) phone = '254' + phone;

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount), // M-Pesa only accepts whole numbers
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: reference || 'Lohan',
      TransactionDesc: description || 'Lohan Deposit'
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.data;
}

// Query STK Push transaction status
async function querySTKStatus(checkoutRequestId) {
  const accessToken = await getAccessToken();
  const shortcode   = process.env.MPESA_SHORTCODE;
  const passkey     = process.env.MPESA_PASSKEY;
  const timestamp   = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password    = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

module.exports = { initiateSTKPush, querySTKStatus };