const axios = require("axios");
require("dotenv").config();

// In-memory storage for payments (replace with a database in production)
const payments = new Map();

class PaymentService {
  constructor() {
    this.paypalClientId = process.env.PAYPAL_CLIENT_ID;
    this.paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.paypalMode = process.env.PAYPAL_MODE || "sandbox";
    this.paypalBaseUrl = this.paypalMode === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    // Log environment configuration
    console.log("Payment Service Configuration:", {
      environment: process.env.NODE_ENV,
      paypalMode: this.paypalMode,
      baseUrl: this.paypalBaseUrl,
      hasClientId: !!this.paypalClientId,
      hasClientSecret: !!this.paypalClientSecret,
    });
  }

  async getAccessToken() {
    try {
      if (!this.paypalClientId || !this.paypalClientSecret) {
        console.error("Missing PayPal credentials:", {
          hasClientId: !!this.paypalClientId,
          hasClientSecret: !!this.paypalClientSecret,
        });
        throw new Error("PayPal credentials are not configured");
      }

      console.log("Requesting PayPal access token...", {
        url: `${this.paypalBaseUrl}/v1/oauth2/token`,
        mode: this.paypalMode,
      });

      const auth = Buffer.from(`${this.paypalClientId}:${this.paypalClientSecret}`).toString("base64");
      console.log("Auth header generated:", !!auth);

      const response = await axios.post(
        `${this.paypalBaseUrl}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
          },
        },
      );

      if (!response.data || !response.data.access_token) {
        console.error("Invalid PayPal response:", response.data);
        throw new Error("Invalid response from PayPal");
      }

      console.log("Successfully obtained PayPal access token");
      return response.data.access_token;
    } catch (error) {
      console.error("PayPal Access Token Error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: "REDACTED",
          },
        },
      });

      // Check for specific error cases
      if (error.response?.status === 401) {
        throw new Error("Invalid PayPal credentials");
      } else if (error.response?.status === 403) {
        throw new Error("PayPal API access forbidden");
      } else if (error.code === "ECONNREFUSED") {
        throw new Error("Could not connect to PayPal API");
      }

      throw new Error(`Failed to get PayPal access token: ${error.message}`);
    }
  }

  async createPayment({ customer_name, customer_email, amount }) {
    try {
      const accessToken = await this.getAccessToken();

      // Create PayPal order
      const response = await axios.post(
        `${this.paypalBaseUrl}/v2/checkout/orders`,
        {
          intent: "CAPTURE",
          purchase_units: [{
            amount: {
              currency_code: "USD",
              value: amount.toString(),
            },
            description: "Payment for services",
            custom_id: `PAY-${Date.now()}`,
          }],
          application_context: {
            brand_name: "Payment Gateway",
            landing_page: "NO_PREFERENCE",
            user_action: "PAY_NOW",
            return_url: process.env.PAYMENT_CALLBACK_URL,
            cancel_url: `${process.env.PAYMENT_CALLBACK_URL}/cancel`,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const paymentData = {
        id: response.data.id,
        customer_name,
        customer_email,
        amount,
        status: "pending",
        payment_url: response.data.links.find((link) => link.rel === "approve").href,
      };

      // Store payment data
      payments.set(paymentData.id, paymentData);

      return paymentData;
    } catch (error) {
      console.error("PayPal API Error:", error.response?.data || error.message);
      throw new Error("Failed to initialize payment");
    }
  }

  async getPaymentById(id) {
    try {
      if (!id) {
        console.error("No payment ID provided");
        throw new Error("Payment ID is required");
      }

      // First check our local storage
      const localPayment = payments.get(id);
      if (localPayment) {
        console.log("Found payment in local storage:", localPayment);
        return localPayment;
      }

      // If not in local storage, check PayPal
      const accessToken = await this.getAccessToken();
      console.log("Fetching payment from PayPal for ID:", id);

      // Get order details from PayPal
      const response = await axios.get(
        `${this.paypalBaseUrl}/v2/checkout/orders/${id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      console.log("PayPal API Response:", response.data);

      // Map PayPal status to our status
      let status;
      switch (response.data.status) {
      case "COMPLETED":
        status = "completed";
        break;
      case "CANCELLED":
      case "VOIDED":
        status = "failed";
        break;
      default:
        status = "pending";
      }

      // Get payment details from the first purchase unit
      const purchaseUnit = response.data.purchase_units[0];
      const amount = purchaseUnit.amount.value;
      const currency = purchaseUnit.amount.currency_code;

      // Get payer details if available
      const payer = response.data.payer || {};
      const customerName = payer.name ? `${payer.name.given_name} ${payer.name.surname}` : "Unknown";
      const customerEmail = payer.email_address || "Unknown";

      const paymentData = {
        id: response.data.id,
        customer_name: customerName,
        customer_email: customerEmail,
        amount: parseFloat(amount),
        currency,
        status,
        payment_url: response.data.links?.find((link) => link.rel === "approve")?.href,
        paypal_response: response.data,
      };

      // Store the payment data
      payments.set(id, paymentData);

      return paymentData;
    } catch (error) {
      console.error("PayPal API Error:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: {
            ...error.config?.headers,
            Authorization: "REDACTED",
          },
        },
      });

      if (error.response?.status === 404) {
        return null;
      }

      // If we have a local payment but PayPal API failed, return the local payment
      const localPayment = payments.get(id);
      if (localPayment) {
        console.log("Returning local payment data after PayPal API error");
        return localPayment;
      }

      throw new Error("Failed to verify payment status");
    }
  }

  async capturePayment(orderId) {
    try {
      const accessToken = await this.getAccessToken();

      // Capture the payment
      const response = await axios.post(
        `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      // Update payment status in our storage
      const payment = payments.get(orderId);
      if (payment) {
        const updatedPayment = {
          ...payment,
          status: "completed",
        };
        payments.set(orderId, updatedPayment);
      }

      return {
        id: orderId,
        status: "completed",
        paypal_response: response.data,
      };
    } catch (error) {
      console.error("PayPal Capture Error:", error.response?.data || error.message);
      throw new Error("Failed to capture payment");
    }
  }
}

module.exports = new PaymentService();
