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
  }

  async getAccessToken() {
    try {
      if (!this.paypalClientId || !this.paypalClientSecret) {
        throw new Error("PayPal credentials are not configured");
      }

      const auth = Buffer.from(`${this.paypalClientId}:${this.paypalClientSecret}`).toString("base64");
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
        throw new Error("Invalid response from PayPal");
      }

      return response.data.access_token;
    } catch (error) {
      console.error("PayPal Access Token Error:", {
        status: error.response?.status,
        message: error.message,
      });

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
            return_url: `${process.env.VERCEL_URL || process.env.PAYMENT_CALLBACK_URL}/api/v1/payments/callback`,
            cancel_url: `${process.env.VERCEL_URL || process.env.PAYMENT_CALLBACK_URL}/api/v1/payments/callback/cancel`,
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
        throw new Error("Payment ID is required");
      }

      const localPayment = payments.get(id);
      if (localPayment) {
        return localPayment;
      }

      const accessToken = await this.getAccessToken();
      const response = await axios.get(
        `${this.paypalBaseUrl}/v2/checkout/orders/${id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

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

      const purchaseUnit = response.data.purchase_units[0];
      const amount = purchaseUnit.amount.value;
      const currency = purchaseUnit.amount.currency_code;

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

      payments.set(id, paymentData);
      return paymentData;
    } catch (error) {
      console.error("PayPal API Error:", {
        status: error.response?.status,
        message: error.message,
      });

      if (error.response?.status === 404) {
        return null;
      }

      const localPayment = payments.get(id);
      if (localPayment) {
        return localPayment;
      }

      throw new Error("Failed to verify payment status");
    }
  }

  async capturePayment(orderId) {
    try {
      const accessToken = await this.getAccessToken();

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
