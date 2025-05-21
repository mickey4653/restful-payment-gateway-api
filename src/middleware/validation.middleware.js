const validatePayment = (req, res, next) => {
  const { customer_name, customer_email, amount } = req.body;

  // Check required fields
  if (!customer_name || !customer_email || !amount) {
    return res.status(400).json({
      status: "error",
      message: "Missing required fields",
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

  // Validate amount is positive
  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({
      status: "error",
      message: "Amount must be a positive number",
    });
  }

  next();
};

module.exports = {
  validatePayment,
};
