# RESTful Payment Gateway API

A RESTful API that allows small businesses to accept payments from customers using PayPal, focusing on minimal customer information (name, email, amount).

## Features

- RESTful API with versioning
- PayPal integration
- Minimal customer information required
- Automated testing and deployment
- CI/CD pipeline with GitHub Actions

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PayPal Developer Account
- GitHub Account
- Vercel Account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd restful-payment-gateway-api
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```
PORT=3000
NODE_ENV=development
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYMENT_CALLBACK_URL=http://localhost:3000/api/v1/payments/callback
```

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Initiate Payment
```http
POST /api/v1/payments
Content-Type: application/json

{
    "customer_name": "John Doe",
    "customer_email": "john@example.com",
    "amount": 50.00
}
```

### Get Payment Status
```http
GET /api/v1/payments/{id}
```

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Deployment

The application is configured to deploy to Vercel automatically through GitHub Actions.

### Manual Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

### Environment Variables in Vercel

Set the following environment variables in your Vercel project:
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- PAYMENT_CALLBACK_URL
- NODE_ENV=production

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

1. Tests run on push and pull requests
2. Automatic deployment to Vercel on merge to main
3. Node.js versions tested: 16.x, 18.x

## Error Handling

The API returns standardized error responses:

```json
{
    "status": "error",
    "message": "Error message here"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.
