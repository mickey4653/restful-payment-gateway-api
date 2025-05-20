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
      const paymentData = {
        customer_name: "John Doe",
        customer_email: "john@example.com",
        amount: 50.00,
      };

      // Mock successful payment creation
      paymentService.createPayment.mockResolvedValue({
        id: "test-order-id",
        status: "created",
        payment_url: "https://www.sandbox.paypal.com/checkoutnow?token=test-token",
      });

      const response = await request(app)
        .post("/api/v1/payments")
        .send(paymentData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.payment).toHaveProperty("id");
      expect(response.body.payment).toHaveProperty("payment_url");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/v1/payments")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Missing required fields: customer_name, customer_email, and amount are required");
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/v1/payments")
        .send({
          customer_name: "John Doe",
          customer_email: "invalid-email",
          amount: 50.00,
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
          amount: -50.00,
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Amount must be a positive number");
    });
  });

  describe("GET /api/v1/payments/:id", () => {
    it("should get payment status successfully", async () => {
      const orderId = "test-order-id";
      const mockPayment = {
        id: orderId,
        status: "completed",
        amount: 50.00,
        customer_name: "John Doe",
        customer_email: "john@example.com",
      };

      // Mock the payment service
      paymentService.getPaymentById.mockResolvedValue(mockPayment);

      const response = await request(app)
        .get(`/api/v1/payments/${orderId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.payment).toEqual(mockPayment);
    });

    it("should handle non-existent payment", async () => {
      // Mock the payment service to return undefined
      paymentService.getPaymentById.mockResolvedValue(undefined);

      const response = await request(app)
        .get("/api/v1/payments/non-existent-id");

      expect(response.status).toBe(404);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Payment not found");
    });
  });

  describe("GET /api/v1/payments/callback", () => {
    it("should handle successful payment callback", async () => {
      // Mock successful payment capture
      paymentService.capturePayment.mockResolvedValue({
        status: "completed",
        id: "test-token",
        amount: 50.00,
        customer_name: "John Doe",
        customer_email: "john@example.com",
      });

      const token = "test-token";
      const payerId = "test-payer-id";

      const response = await request(app)
        .get(`/api/v1/payments/callback?token=${token}&PayerID=${payerId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.payment).toHaveProperty("status");
    });

    it("should handle missing token", async () => {
      const response = await request(app)
        .get("/api/v1/payments/callback?PayerID=test-payer-id");

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Missing required parameters");
    });

    it("should handle missing PayerID", async () => {
      const response = await request(app)
        .get("/api/v1/payments/callback?token=test-token");

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.message).toBe("Missing required parameters");
    });
  });
});
