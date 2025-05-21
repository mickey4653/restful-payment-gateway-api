const axios = require("axios");
require("dotenv").config();

// In-memory storage for payments (replace with a database in production)
const payments = new Map();

class PaymentService {
  constructor() {
    this.mode = process.env.PAYPAL_MODE || "sandbox";
    this.baseUrl = this.mode === "production"
      ? "https://api.paypal.com"
      : "https://api.sandbox.paypal.com";
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.callbackUrl = process.env.NODE_ENV === "production"
      ? "https://restful-payment-gateway-api.vercel.app/api/v1/payments/callback"
      : "http://localhost:3000/api/v1/payments/callback";
    this.cancelUrl = process.env.NODE_ENV === "production"
      ? "https://restful-payment-gateway-api.vercel.app/api/v1/payments/callback/cancel"
      : "http://localhost:3000/api/v1/payments/callback/cancel";
  }

  async getAccessToken() {
    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString("base64");

      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      console.error("Error getting access token:", error.response?.data || error.message);
      throw new Error("Failed to get PayPal access token");
    }
  }

  async createPayment(paymentData) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: paymentData.amount.toString(),
              },
              description: `Payment for ${paymentData.customer_name}`,
              custom_id: paymentData.customer_email,
            },
          ],
          application_context: {
            return_url: this.callbackUrl,
            cancel_url: this.cancelUrl,
            brand_name: "Your Company Name",
            landing_page: "LOGIN",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      // Create the payment data with all required fields
      const paymentResponse = {
        id: response.data.id,
        customer_name: paymentData.customer_name,
        customer_email: paymentData.customer_email,
        amount: paymentData.amount,
        status: "pending",
        payment_url: response.data.links.find(
          (link) => link.rel === "approve",
        ).href,
      };

      // Store the payment data
      payments.set(paymentResponse.id, paymentResponse);

      return paymentResponse;
    } catch (error) {
      console.error("Error creating payment:", error.response?.data || error.message);
      throw new Error("Failed to create PayPal payment");
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
        `${this.baseUrl}/v2/checkout/orders/${id}`,
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
        status = "cancelled";
        break;
      default:
        status = "pending";
      }

      const purchaseUnit = response.data.purchase_units[0];
      const amount = purchaseUnit.amount.value;
      const currency = purchaseUnit.amount.currency_code;

      const payer = response.data.payer || {};
      const customerName = payer.name
        ? `${payer.name.given_name} ${payer.name.surname}`
        : "Unknown";
      const customerEmail = payer.email_address || "Unknown";

      const paymentData = {
        id: response.data.id,
        customer_name: customerName,
        customer_email: customerEmail,
        amount: parseFloat(amount),
        currency,
        status,
        payment_url: response.data.links?.find((link) => link.rel === "approve")
          ?.href,
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
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      // Get the stored payment data
      const storedPayment = payments.get(orderId);
      if (!storedPayment) {
        throw new Error("Payment not found");
      }

      // Extract payment details from PayPal response
      const capture = response.data.purchase_units[0].payments.captures[0];
      const currency = capture.amount.currency_code;
      const amount = parseFloat(capture.amount.value);

      // Update the payment status while preserving original customer info
      const updatedPayment = {
        ...storedPayment,
        status: "completed",
        currency,
        amount,
        paypal_response: response.data,
      };

      // Store the updated payment
      payments.set(orderId, updatedPayment);

      return {
        status: "success",
        data: updatedPayment,
      };
    } catch (error) {
      console.error("Error capturing payment:", error.response?.data || error.message);
      throw new Error("Failed to capture PayPal payment");
    }
  }
}

module.exports = new PaymentService();
