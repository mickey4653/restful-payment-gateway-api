const request = require("supertest");
const app = require("../app");
const paymentService = require("../services/payment.service");

// Mock PayPal SDK
jest.mock("@paypal/paypal-server-sdk", () => ({
  core: {
    SandboxEnvironment: jest.fn(),
    LiveEnvironment: jest.fn(),
    PayPalHttpClient: jest.fn(),
  },
  orders: {
    OrdersCreateRequest: jest.fn(),
    OrdersCaptureRequest: jest.fn(),
    OrdersGetRequest: jest.fn(),
  },
}));

// Mock payment service methods
jest.mock("../services/payment.service", () => ({
  createPayment: jest.fn(),
  getPaymentById: jest.fn(),
  capturePayment: jest.fn(),
}));

describe("Payment API", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("POST /api/v1/payments", () => {
    it("should create a payment successfully", async () => {
      const mockPayment = {
        id: "test-order-id",
        customer_name: "John Doe",
        customer_email: "john@example.com",
        amount: 50,
        status: "pending",
        payment_url: "https://www.sandbox.paypal.com/checkoutnow?token=test-token",
      };

      paymentService.createPayment.mockResolvedValue(mockPayment);

      const response = await request(app)
        .post("/api/v1/payments")
        .send({
          customer_name: "John Doe",
          customer_email: "john@example.com",
          amount: 50,
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("payment_url");
      expect(response.body.data).toEqual(mockPayment);
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v1/payments")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Missing required fields");
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/v1/payments")
        .send({
          customer_name: "John Doe",
          customer_email: "invalid-email",
          amount: 50,
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Invalid email format");
    });

    it("should validate amount is positive", async () => {
      const response = await request(app)
        .post("/api/v1/payments")
        .send({
          customer_name: "John Doe",
          customer_email: "john@example.com",
          amount: -50,
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Amount must be a positive number");
    });
  });

  describe("GET /api/v1/payments/:id", () => {
    it("should get payment status successfully", async () => {
      const mockPayment = {
        id: "test-order-id",
        customer_name: "John Doe",
        customer_email: "john@example.com",
        amount: 50,
        status: "completed",
      };

      paymentService.getPaymentById.mockResolvedValue(mockPayment);

      const response = await request(app)
        .get("/api/v1/payments/test-order-id");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data).toEqual(mockPayment);
    });

    it("should handle non-existent payment", async () => {
      paymentService.getPaymentById.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/payments/non-existent-id");

      expect(response.status).toBe(404);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Payment not found");
    });
  });

  describe("GET /api/v1/payments/callback", () => {
    it("should handle successful payment callback", async () => {
      const token = "test-token";
      const mockPayment = {
        id: token,
        status: "completed",
      };

      paymentService.capturePayment.mockResolvedValue(mockPayment);

      const response = await request(app)
        .get(`/api/v1/payments/callback?token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toBe("Payment completed successfully");
      expect(response.body.data).toEqual(mockPayment);
    });

    it("should handle missing token", async () => {
      const response = await request(app)
        .get("/api/v1/payments/callback");

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Payment token is required");
    });
  });

  describe("GET /api/v1/payments/callback/cancel", () => {
    it("should handle payment cancellation", async () => {
      const token = "test-token";
      const mockPayment = {
        id: token,
        status: "cancelled",
      };

      paymentService.getPaymentById.mockResolvedValue(mockPayment);

      const response = await request(app)
        .get(`/api/v1/payments/callback/cancel?token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toBe("Payment was cancelled");
      expect(response.body.data).toEqual(mockPayment);
    });

    it("should handle missing token", async () => {
      const response = await request(app)
        .get("/api/v1/payments/callback/cancel");

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Payment token is required");
    });
  });
});
