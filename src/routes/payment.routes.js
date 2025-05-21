const express = require("express");

const router = express.Router();
const paymentService = require("../services/payment.service");
const { validatePayment } = require("../middleware/validation.middleware");

// Create a new payment
router.post("/", validatePayment, async (req, res, next) => {
  try {
    const { customer_name, customer_email, amount } = req.body;
    const payment = await paymentService.createPayment({
      customer_name,
      customer_email,
      amount,
    });
    res.status(201).json({
      status: "success",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

// Handle PayPal callback
router.get("/callback", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "Payment token is required",
      });
    }

    const result = await paymentService.capturePayment(token);

    // Return a cleaner response structure
    res.status(200).json({
      status: "success",
      message: "Payment completed successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error capturing payment:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process payment",
      error: error.message,
    });
  }
});

// Handle PayPal cancel
router.get("/callback/cancel", async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "Payment token is required",
      });
    }

    const payment = await paymentService.getPaymentById(token);
    if (payment) {
      payment.status = "cancelled";
    }

    res.status(200).json({
      status: "success",
      message: "Payment was cancelled",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

// Get payment status
router.get("/:id", async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        status: "error",
        message: "Payment not found",
      });
    }
    res.status(200).json({
      status: "success",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
