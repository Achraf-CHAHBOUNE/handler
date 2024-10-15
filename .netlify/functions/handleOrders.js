const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const total =
      data.data.product?.price_display || data.data.product?.price || "N/A";
    const currency = data.data.currency || "N/A";
    const status = data.data.status || "N/A";

    const customFields = data.data.custom_fields || {};
    const fullName = customFields["Full name"] || "N/A";
    const country = customFields["Country"] || "N/A";
    const whatsapp = customFields["Whatsapp Number"] || "N/A";

    // Insert data into the Supabase orders table
    const { data: insertData, error } = await supabase.from("orders").insert([
      {
        order_id: orderId,
        product_id: productId,
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

    if (error) throw error;

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
