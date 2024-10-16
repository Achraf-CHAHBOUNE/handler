const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

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
    const orderId = data.data.id || "N/A";
    const productId = data.data.product_id || "N/A";
    const email = data.data.customer_email || "N/A";
    const productName = data.data.product_title || "N/A";
    const total = data.data.product
      ? data.data.product.price_display
        ? data.data.product.price_display
        : data.data.product.price
      : "N/A";

    const currency = data.data.currency || "N/A";
    const status = data.data.status || "N/A";

    const customFields = data.data.custom_fields || {};
    const fullName = customFields["Full name"] || "N/A";
    const country = customFields["Country"] || "N/A";
    const whatsapp = customFields["Whatsapp Number"] || "N/A";

    // Insert data into the Supabase orders table
    const { data: insertData, error } = await supabase.from("orders").insert([
      {
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
      },
    ]);

    console.log("Email:", process.env.EMAIL_USER);
    console.log("Password:", process.env.EMAIL_PASS);

    if (error) throw error;

    // Send confirmation email
    const mailOptions = {
      from: '"IPTVV Support Team" <support@iptvv.shop>', // sender address
      to: email, // list of receivers
      subject: "Order Confirmation", // Subject line
      text: `Hello ${fullName},\n\nThank you for your order!\n\nOrder ID: ${orderId}\nProduct: ${productName}\nTotal: ${total} ${currency}\nStatus: ${status}\n\nIf you have any questions, feel free to reach out to us.\n\nBest,\nSupport Team`, // plain text body
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
