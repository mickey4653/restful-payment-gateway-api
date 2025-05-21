require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

// Error handling middleware
app.use((err, req, res) => {
  console.error("Error:", err);
  res.status(500).json({
    status: "error",
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Environment:", process.env.NODE_ENV);
  console.log("PayPal Mode:", process.env.PAYPAL_MODE);
});
