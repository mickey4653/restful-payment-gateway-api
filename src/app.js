const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const paymentService = require("./services/payment.service");

// Import routes
const paymentRoutes = require("./routes/payment.routes");

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan("dev")); // Logging
app.use(express.json()); // Parse JSON bodies

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to Payment Gateway API",
    version: "1.0.0",
    endpoints: {
      health: "/api/v1/health",
      payments: {
        create: "POST /api/v1/payments",
        status: "GET /api/v1/payments/:id",
        callback: "GET /api/v1/payments/callback",
      },
    },
    documentation:
      "Please refer to the README.md for detailed API documentation",
  });
});

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// PayPal configuration test endpoint
app.get("/api/v1/test-paypal", async (req, res) => {
  try {
    const accessToken = await paymentService.getAccessToken();
    res.status(200).json({
      status: "success",
      message: "PayPal configuration is valid",
      environment: process.env.NODE_ENV,
      paypalMode: process.env.PAYPAL_MODE,
      hasAccessToken: !!accessToken,
    });
  } catch (error) {
    console.error("PayPal Test Error:", error);
    res.status(500).json({
      status: "error",
      message: "PayPal configuration test failed",
      error: error.message,
      environment: process.env.NODE_ENV,
      paypalMode: process.env.PAYPAL_MODE,
      hasClientId: !!process.env.PAYPAL_CLIENT_ID,
      hasClientSecret: !!process.env.PAYPAL_CLIENT_SECRET,
    });
  }
});

// Routes
app.use("/api/v1/payments", paymentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Something went wrong!",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
    availableEndpoints: {
      root: "/",
      health: "/api/v1/health",
      payments: "/api/v1/payments",
    },
  });
});

module.exports = app;
 