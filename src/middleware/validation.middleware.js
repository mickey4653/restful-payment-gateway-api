const validatePayment = (req, res, next) => {
  const { customer_name, customer_email, amount } = req.body;

  // Debug logging
  console.log("Raw Input:", {
    amount,
    amountType: typeof amount,
    amountValue: amount,
  });

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

  // Handle amount validation for both string and number inputs
  let amountNum;
  try {
    if (typeof amount === "string") {
      // Remove any currency symbols, commas, and whitespace
      const cleanAmount = amount.replace(/[$,]/g, "").trim();
      // Use Number() instead of parseFloat for more consistent behavior
      amountNum = Number(cleanAmount);
      console.log("String Amount Processing:", {
        original: amount,
        cleaned: cleanAmount,
        parsed: amountNum,
        isNaN: Number.isNaN(amountNum),
      });
    } else {
      amountNum = Number(amount);
      console.log("Number Amount Processing:", {
        original: amount,
        parsed: amountNum,
        isNaN: Number.isNaN(amountNum),
      });
    }

    // Validate the amount
    if (Number.isNaN(amountNum)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid amount format",
        debug: {
          originalAmount: amount,
          amountType: typeof amount,
          parsedAmount: amountNum,
        },
      });
    }

    if (amountNum <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Amount must be greater than zero",
        debug: {
          originalAmount: amount,
          parsedAmount: amountNum,
        },
      });
    }

    // Update the request body with the converted number
    req.body.amount = amountNum;
    next();
  } catch (error) {
    console.error("Amount Validation Error:", error);
    return res.status(400).json({
      status: "error",
      message: "Error processing amount",
      debug: {
        originalAmount: amount,
        error: error.message,
      },
    });
  }
};

module.exports = {
  validatePayment,
};
