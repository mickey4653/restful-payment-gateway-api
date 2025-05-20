const paymentService = require("../services/payment.service");

const paymentController = {
  // Initiate a new payment
  async initiatePayment(req, res) {
    try {
      const { customer_name, customer_email, amount } = req.body;

      // Validate required fields
      if (!customer_name || !customer_email || !amount) {
        return res.status(400).json({
          status: "error",
          message:
            "Missing required fields: customer_name, customer_email, and amount are required",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer_email)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid email format",
        });
      }

      // Validate amount
      if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Amount must be a positive number",
        });
      }

      const payment = await paymentService.createPayment({
        customer_name,
        customer_email,
        amount,
      });

      res.status(201).json({
        status: "success",
        message: "Payment initiated successfully",
        payment,
      });
    } catch (error) {
      console.error("Payment initiation error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to initiate payment",
      });
    }
  },

  // Get payment status
  async getPaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);

      if (!payment) {
        return res.status(404).json({
          status: "error",
          message: "Payment not found",
        });
      }

      res.json({
        status: "success",
        message: "Payment details retrieved successfully",
        payment,
      });
    } catch (error) {
      console.error("Payment status retrieval error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve payment status",
      });
    }
  },

  // Handle PayPal callback
  async handleCallback(req, res) {
    try {
      const { token, PayerID } = req.query;

      if (!token || !PayerID) {
        return res.status(400).json({
          status: "error",
          message: "Missing required parameters",
        });
      }

      console.log(
        "Received callback with token:",
        token,
        "and PayerID:",
        PayerID,
      );

      // Capture the payment
      const payment = await paymentService.capturePayment(token);

      // Return success response
      res.json({
        status: "success",
        message: "Payment completed successfully",
        payment,
      });
    } catch (error) {
      console.error("Payment callback error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to process payment callback",
        error: error.message,
      });
    }
  },
};

module.exports = paymentController;
