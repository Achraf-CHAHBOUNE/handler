const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { Mutex } = require('async-mutex');

// 🌐 Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const apiKey = process.env.API_KEY;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

// Ensure environment variables are set
if (!supabaseUrl || !supabaseKey || !apiKey || !emailUser || !emailPass) {
  throw new Error('Missing required environment variables');
}

// ✅ Initialize Services
const supabase = createClient(supabaseUrl, supabaseKey);
const mutex = new Mutex();

// 📧 Email Transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 587,
  secure: false,
  auth: { user: emailUser, pass: emailPass },
});

// 🎯 Package ID for Trial
const packageIds = { trial: '123' };

// 🛡️ Helper Functions

/**
 * Validate incoming request data.
 */
const validateRequestData = (data) => {
  if (!data.full_name || !data.email) throw new Error('Full name and email are required.');
  if (!/\S+@\S+\.\S+/.test(data.email)) throw new Error('Invalid email format.');
};

/**
 * Check for duplicate trial requests based on email.
 */
const checkDuplicate = async (email) => {
  const { data, error } = await supabase
    .from('Trial')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Error checking duplicates:', error);
    return false;
  }

  return !!data; // Returns true if duplicate exists
};

/**
 * Create IPTV trial credentials.
 */
const createM3ULine = async (packageId, note = '', country = '') => {
  try {
    const apiUrl = `http://api1.vpn-cloud.icu/api/dev_api.php?action=user&type=create&package_id=${packageId}&api_key=${apiKey}&note=${note}&country=${country}`;
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error('IPTV API Error:', error);
    throw new Error('Failed to create IPTV trial credentials.');
  }
};

/**
 * Generate HTML for the trial email.
 */
const generateEmailHtml = (fullName, productName, total, currency, status, m3u) => {
  const m3uResponse = m3u[0];
  const m3uDetails = m3uResponse.status ? `
    <tr>
      <td style="padding: 12px; border: 1px solid #ccc;">M3U URL</td>
      <td style="padding: 12px; border: 1px solid #ccc;"><a href="${m3uResponse.url}">${m3uResponse.url}</a></td>
    </tr>
    <tr>
      <td style="padding: 12px; border: 1px solid #ccc;">Username</td>
      <td style="padding: 12px; border: 1px solid #ccc;">${m3uResponse.username}</td>
    </tr>
    <tr>
      <td style="padding: 12px; border: 1px solid #ccc;">Password</td>
      <td style="padding: 12px; border: 1px solid #ccc;">${m3uResponse.password}</td>
    </tr>` : '';

  const apologyMessage = status !== 'Test sent'
    ? ''
    : '<p style="font-weight: bold; color: red;">We apologize for the inconvenience, but we have reached our daily limit for IPTV trial tests. Your trial will be sent tomorrow, and you will receive an email once available.</p>';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0;">
      <div style="background-color: #4CAF50; color: white; padding: 10px; text-align: center;">
        <h1>Order Confirmation</h1>
      </div>
      <div style="padding: 20px;">
        <p style="font-size: 16px;">Thank you for choosing IPTVV! We're excited to have you as a customer and are committed to providing you with the best service.</p>
        <h2 style="color: #333;">Hello ${fullName},</h2>
        <p>Thank you for your order! Below are the details:</p>
        <h3 style="color: #333;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
          <tr style="background-color: #f4f4f4;">
            <th style="padding: 12px; border: 1px solid #ccc; text-align: left;">Field</th>
            <th style="padding: 12px; border: 1px solid #ccc; text-align: left;">Details</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ccc;">Product</td>
            <td style="padding: 12px; border: 1px solid #ccc;">${productName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ccc;">Total</td>
            <td style="padding: 12px; border: 1px solid #ccc;">${total} ${currency}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ccc;">Status</td>
            <td style="padding: 12px; border: 1px solid #ccc;">${status}</td>
          </tr>
          ${m3uDetails}
        </table>
        ${apologyMessage}
        <p>If you have any questions or need assistance, feel free to reach out to us at any time.</p>
        <p style="font-weight: bold;">You will receive a message here in your email and via WhatsApp number to activate your subscription once the trial is available.</p>
      </div>
      <div style="background-color: #f4f4f4; padding: 10px; text-align: center;">
        <p style="margin: 0;">Best Regards,<br>The IPTVV Support Team</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} IPTVV, All Rights Reserved.</p>
        visit us at <a href="https://iptvv.shop">iptvv.shop</a>
      </div>
    </div>
  `;
};

// 🚀 Main Handler
exports.handler = async (event, context) => {
  return await mutex.runExclusive(async () => {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ status: 'error', message: 'Method Not Allowed' }) };
    }

    try {
      const data = JSON.parse(event.body);
      validateRequestData(data);

      const { full_name: fullName, email, country = 'N/A', whatsapp = 'N/A', status = 'N/A' } = data;

      console.log(`New Trial Request: ${fullName} (${email})`);

      // 🛡️ Check for duplicates
      const isDuplicate = await checkDuplicate(email);
      if (isDuplicate) {
        return {
          statusCode: 400,
          body: JSON.stringify({ status: 'error', message: 'Duplicate trial request detected.' }),
        };
      }

      // 📧 Generate email content
      const m3uResponse = await createM3ULine(packageIds.trial, `${fullName} - ${email}`, country);
      const emailHtml = generateEmailHtml(fullName, 'IPTV Trial', '0.00', 'USD', status, m3uResponse);

      // Send email
      await transporter.sendMail({
        from: emailUser,
        to: email,
        subject: 'Your IPTV Trial Access',
        html: emailHtml,
      });

      // 📑 Log to Supabase
      await supabase.from('Trial').insert([
        { 
          Horodateur: new Date().toISOString(),  // Current timestamp
          Full_Name: fullName, 
          Email: email, 
          Country: country, 
          WhatsApp_Number: whatsapp, 
          Status: 'Test Sent' 
        }
      ]);

      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'success', message: 'Test sent successfully!' }),
      };
    } catch (error) {
      console.error('Handler Error:', error);

      // Apology message if test is not sent
      return {
        statusCode: 500,
        body: JSON.stringify({ status: 'error', message: `We're sorry, but there was an issue sending your trial. Please try again later.` }),
      };
    }
  });
};