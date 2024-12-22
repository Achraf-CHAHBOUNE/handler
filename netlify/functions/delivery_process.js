const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const axios = require("axios");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com", // Zoho SMTP server
  port: 587, // SMTP port
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const packageIds = {
  "Golden 12 Month Subscription": "10",
  "Golden 6 Month Subscription": "111",
  "Golden 3 Month Subscription": "110",
  "Golden 1 Month Subscription": "109",
  "Platinum 12 Month Subscription": "152",
  "Platinum 6 Month Subscription": "151",
  "Platinum 3 Month Subscription": "150",
  "Platinum 1 Month Subscription": "149",
  "Trial of Service": "143",
};

const createM3ULine = async (packageId, note = "", country = "", templateId = "") => {
  const apiKey = process.env.API_KEY;
  let apiUrl = `http://api1.vpn-cloud.icu/api/dev_api.php?action=user&type=create&package_id=${packageId}&api_key=${apiKey}`;

  if (note) {
    apiUrl += `&note=${note}`;
  }
  if (country) {
    apiUrl += `&country=${country}`;
  }
  if (templateId) {
    apiUrl += `&template_id=${templateId}`;
  }

  try {
    const response = await axios.get(apiUrl);
    return response.data;
  } catch (error) {
    console.error("Error creating M3U line:", error);
    return { status: "error", message: error.message };
  }
};

const generateEmailHtml = (fullName, orderId, productName, total, currency, status, m3uResponse) => {
  const m3uDetails = m3uResponse.status === true ? `
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
            <td style="padding: 12px; border: 1px solid #ccc;">Order ID</td>
            <td style="padding: 12px; border: 1px solid #ccc;">${orderId}</td>
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
        <p>If you have any questions or need assistance, feel free to reach out to us at any time.</p>
        <p style="font-weight: bold;">You will receive a message here in your email and via WhatsApp number to activate your subscription.</p>
      </div>
      <div style="background-color: #f4f4f4; padding: 10px; text-align: center;">
        <p style="margin: 0;">Best Regards,<br>The IPTVV Support Team</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} IPTVV, All Rights Reserved.</p>
      </div>
    </div>
  `;
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  try {
    const data = JSON.parse(event.body);
    console.log("Incoming POST Data:", data);

    // Extract necessary fields
    const { id: orderId, product_id: productId, customer_email: email, product_title: productName, currency, status, custom_fields: customFields = {} } = data.data;
    const { price_display: total = data.data.product.price } = data.data.product || {};
    const { "Full name": fullName = "N/A", "Country": country = "N/A", "Whatsapp Number": whatsapp = "N/A" } = customFields;

    // Insert data into the Supabase orders table
    const { data: insertData, error } = await supabase.from("orders").insert([{
      orderid: orderId,
      productid: productId,
      full_name: fullName,
      country: country,
      whatsapp: whatsapp,
      customer_email: email,
      product_title: productName,
      total: total,
      currency: currency,
      status: status,
      created_at: new Date(),
    }]);

    if (error) throw error;

    // Create M3U line
    const packageId = packageIds[productName];
    const note = `${fullName} - ${email}`;
    const m3uResponse = await createM3ULine(packageId, note, country);

    // Generate email HTML
    const html = generateEmailHtml(fullName, orderId, productName, total, currency, status, m3uResponse);

    // Send email
    const mailOptions = {
      from: '"IPTVV Support Team" <support@iptvv.shop>', // sender address
      to: email, // list of receivers
      subject: "Order Confirmation", // Subject line
      html: html,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");

    return {
      statusCode: 200,
      body: JSON.stringify({ status: "success", data: insertData }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", message: error.message }),
    };
  }
};