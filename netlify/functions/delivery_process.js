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

const packageNames = {
  "Golden 12 month subscription": "10", // 12 months
  "Golden 6 month subscription": "111", // 6 months
  "Golden 3 month subscription": "110", // 3 months
  "Golden 1 month subscription": "109", // 1 month
  "Platinum 12 month subscription": "152", // 4k 12 months
  "Platinum 6 month subscription": "151", // 4k 6 months
  "Platinum 3 month subscription": "150", // 4k 3 months
  "Platinum 1 month subscription": "149", // 4k 1 month
  "Free trial": "143", // 4k 24 hours trial
};

const createM3ULine = async (
  packageId,
  note = "",
  country = "",
  templateId = ""
) => {
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

const generateEmailHtml = (
  fullName,
  orderId,
  productName,
  total,
  currency,
  status,
  m3u
) => {
  const m3uResponse = m3u[0];
  const m3uDetails =
    m3uResponse.status == true
      ? `
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
    </tr>`
      : "";

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

    // Extract necessary fields from Payhip payload
    const { id, email, currency, price, items, type } = data;
    const productName = items[0]?.product_name || "N/A";
    const productId = items[0]?.product_id || "N/A";

    // Extract custom questions from Payhip payload
    const checkoutQuestions = data.checkout_questions;

    // Find Full Name
    const fullNameQuestion = checkoutQuestions.find(
      (q) => q.question === "Full Name"
    );
    const fullName = fullNameQuestion ? fullNameQuestion.response : "N/A";

    // Find Whatsapp number
    const whatsappQuestion = checkoutQuestions.find(
      (q) => q.question === "Whatsapp number"
    );
    const whatsapp = whatsappQuestion ? whatsappQuestion.response : "N/A";

    const countryQuestion = checkoutQuestions.find(
      (q) => q.question === "Country"
    );

    const country = countryQuestion ? countryQuestion.response : "N/A"; // Modify as needed

    // Insert data into the Supabase orders table
    const { data: insertData, error } = await supabase.from("orders").insert([
      {
        orderid: id,
        productid: productId,
        full_name: fullName,
        country: country,
        whatsapp: whatsapp,
        customer_email: email,
        product_title: productName,
        total: price,
        currency: currency,
        status: type === "paid" ? "Completed" : "Pending",
        created_at: new Date(),
      },
    ]);

    if (error) throw error;

    // Create M3U line
    const packageId = packageNames[productName];
    const m3uResponse = await createM3ULine(
      packageId,
      `${fullName} - ${email}`,
      country
    );

    console.log("M3U Response:", m3uResponse);

    // Generate email HTML
    const html = generateEmailHtml(
      fullName,
      id,
      productName,
      price,
      currency,
      type,
      m3uResponse
    );

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
