const express = require("express");

const router = express.Router();
const paymentController = require("../controllers/payment.controller");

// POST /api/v1/payments - Initiate a payment
router.post("/", paymentController.initiatePayment);

// GET /api/v1/payments/callback - Handle PayPal callback
router.get("/callback", paymentController.handleCallback);

// GET /api/v1/payments/:id - Get payment status
router.get("/:id", paymentController.getPaymentStatus);

module.exports = router;
