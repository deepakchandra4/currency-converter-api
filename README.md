# Currency Converter API

A production-style, clean, and developer-friendly Currency Converter REST API built with **NestJS**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**. It fetches real-time foreign exchange rates from a live public exchange-rate API, computes currency conversions with decimal precision, logs transaction histories into PostgreSQL, and provides paginated history access.

---

## 1. Project Overview

The **Currency Converter API** enables clients to perform real-time currency conversions between standard ISO 4217 3-letter currency codes (e.g., USD, EUR, INR, GBP, JPY). Every successful conversion is persisted into a PostgreSQL database, and clients can retrieve paginated conversion histories sorted by newest records first.

The project emphasizes simplicity, strong type safety, robust input validation, clear separation of concerns, and resilient upstream error handling.

---

## 2. Features

- **Live Currency Conversion**: Fetches real-time exchange rates from an external open exchange rate API without hard-coded rates.
- **Same-Currency Optimization**: Instantly resolves conversions between identical currencies (e.g., `USD` to `USD`) with an exchange rate of `1.0` without unnecessary network requests.
- **Financial Precision**: Employs Prisma `Decimal` types (`DECIMAL(18, 4)` and `DECIMAL(18, 6)`) to eliminate floating-point rounding errors.
- **Conversion Audit History**: Automatically persists each successful conversion in PostgreSQL with timestamps.
- **Server-Side Pagination**: Efficiently paginates conversion records using database-level `skip` and `take`, returning complete metadata (`total`, `page`, `limit`, `totalPages`).
- **Comprehensive Input Validation**: Validates query parameters using `class-validator` and `class-transformer` (ISO currency codes, positive numbers, integer pagination boundaries).
- **Graceful Error Handling**: Sanitizes error responses, mapping client errors to `400 Bad Request`, upstream API failures to `502 Bad Gateway`, and server faults to `500 Internal Server Error` without exposing stack traces or sensitive credentials.
- **100% Test Coverage on Core Logic**: Complete suite of unit and integration tests covering all validation rules, edge cases, external API timeouts, and database error states.

---

## 3. Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (v11)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (v5)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (v14+)
- **ORM**: [Prisma](https://www.prisma.io/) (v6)
- **Validation & Transformation**: `class-validator`, `class-transformer`
- **Configuration**: `@nestjs/config`
- **Testing**: [Jest](https://jestjs.io/), [Supertest](https://github.com/ladjs/supertest)
- **External Currency Provider**: Open Exchange Rates API (`open.er-api.com`)

---

## 4. Project Structure

```
currency-converter-api/
├── prisma/
│   ├── schema.prisma              # Prisma schema definition
│   └── migrations/                # SQL migration files
│       └── 20261008050959_init/
│           └── migration.sql
├── src/
│   ├── currency/
│   │   ├── dto/
│   │   │   ├── convert-currency.dto.ts  # Validation for /currency/convert
│   │   │   └── history-query.dto.ts     # Validation for /currency/history
│   │   ├── currency.controller.ts       # REST controller routing
│   │   ├── currency.controller.spec.ts  # HTTP integration & validation tests
│   │   ├── currency.service.ts          # Core conversion & history logic
│   │   ├── currency.service.spec.ts     # Unit tests for currency service
│   │   └── currency.module.ts           # Feature module definition
│   ├── app.module.ts                    # Root module
│   ├── http-exception.filter.ts         # Global exception filter (sanitization)
│   ├── main.ts                          # Application bootstrap entrypoint
│   └── prisma.service.ts                # PrismaClient lifecycle provider
├── .env.example                         # Environment configuration template
├── .gitignore                           # Git ignore rules (protects secrets)
├── nest-cli.json                        # NestJS CLI configuration
├── package.json                         # Dependencies & npm scripts
├── tsconfig.json                        # TypeScript compiler options
├── README.md                            # Project setup and user guide

```

---

## 5. Prerequisites

Before running the application, ensure the following are installed on your machine:

- **Node.js**: `v18.x` or higher (tested on Node `v24.x`)
- **NPM**: `v9.x` or higher
- **PostgreSQL**: `v14` or higher running locally or accessible via network
- **Git**

---

## 6. PostgreSQL Setup

1. Verify that your PostgreSQL server is active.
2. Create a dedicated database for this application:

```sql
CREATE DATABASE currency_converter;
```

---

## 7. Environment Variables

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/currency_converter?schema=public"

# External exchange rate API URL (open.er-api.com requires no API key)
CURRENCY_API_URL="https://open.er-api.com/v6/latest"

# Application listening port (defaults to 3000)
PORT=3000
```

> **Security Note**: Never commit the `.env` file into Git. It is already excluded in `.gitignore`.

---

## 8. Installation

Install all project dependencies:

```bash
npm install
```

---

## 9. Prisma Setup

Generate the Prisma Client TypeScript types:

```bash
npm run prisma:generate
```

---

## 10. Database Migration

Run the Prisma migration to create the `conversion_history` table and indices in PostgreSQL:

```bash
npm run prisma:migrate
```

*(For production environments, use `npm run prisma:migrate:deploy`)*.

---

## 11. Running in Development

Start the application in development mode with hot-reloading:

```bash
npm run start:dev
```

The API will start listening at: `http://localhost:3000`.

---

## 12. Building for Production

Compile the TypeScript source code into JavaScript in the `dist/` directory:

```bash
npm run build
```

---

## 13. Running Production Build

Execute the compiled application:

```bash
npm run start:prod
```

---

## 14. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/currency/convert` | Converts an amount between two currencies using live rates |
| `GET` | `/currency/history` | Retrieves paginated conversion audit history |

---

## 15. Request Examples

### Convert Currency
```bash
# Convert 100 USD to INR
curl -X GET "http://localhost:3000/currency/convert?from=USD&to=INR&amount=100"

# Convert 50 EUR to JPY
curl -X GET "http://localhost:3000/currency/convert?from=EUR&to=JPY&amount=50"

# Same currency conversion (100 USD to USD)
curl -X GET "http://localhost:3000/currency/convert?from=USD&to=USD&amount=100"
```

### Retrieve Conversion History
```bash
# First page (default limit 10)
curl -X GET "http://localhost:3000/currency/history?page=1&limit=10"

# Second page with custom limit
curl -X GET "http://localhost:3000/currency/history?page=2&limit=5"
```

---

## 16. Response Examples

### Successful Conversion (`200 OK`)
```json
{
  "from": "USD",
  "to": "INR",
  "amount": 100,
  "exchangeRate": 96.830256,
  "convertedAmount": 9683.0256
}
```

### Successful History Retrieval (`200 OK`)
```json
{
  "data": [
    {
      "id": 3,
      "from": "EUR",
      "to": "JPY",
      "amount": 50,
      "exchangeRate": 176.960646,
      "convertedAmount": 8848.0323,
      "createdAt": "2026-10-08T05:18:49.635Z"
    },
    {
      "id": 2,
      "from": "USD",
      "to": "USD",
      "amount": 100,
      "exchangeRate": 1,
      "convertedAmount": 100,
      "createdAt": "2026-10-08T05:18:36.346Z"
    },
    {
      "id": 1,
      "from": "USD",
      "to": "INR",
      "amount": 100,
      "exchangeRate": 96.830256,
      "convertedAmount": 9683.0256,
      "createdAt": "2026-10-08T05:18:26.634Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

## 17. Validation Examples

All incoming query parameters are validated through DTOs before reaching service logic.

### Missing Parameter (`amount`)
**Request:**
`GET /currency/convert?from=USD&to=INR`

**Response (`400 Bad Request`):**
```json
{
  "statusCode": 400,
  "message": [
    "amount must be greater than 0",
    "amount must be a valid number",
    "amount is required"
  ]
}
```

### Invalid Currency Code Length (`from=US`)
**Request:**
`GET /currency/convert?from=US&to=INR&amount=100`

**Response (`400 Bad Request`):**
```json
{
  "statusCode": 400,
  "message": [
    "from currency must contain only alphabetic characters",
    "from currency must be exactly 3 characters"
  ]
}
```

### Negative or Zero Amount (`amount=-10`)
**Request:**
`GET /currency/convert?from=USD&to=INR&amount=-10`

**Response (`400 Bad Request`):**
```json
{
  "statusCode": 400,
  "message": [
    "amount must be greater than 0"
  ]
}
```

### History Limit Exceeding Maximum (`limit=150`)
**Request:**
`GET /currency/history?page=1&limit=150`

**Response (`400 Bad Request`):**
```json
{
  "statusCode": 400,
  "message": [
    "limit cannot exceed 100"
  ]
}
```

---

## 18. Error Responses

The API uses standardized, sanitized JSON error responses across all failure scenarios:

| Status Code | Scenario | Sample Response |
| :--- | :--- | :--- |
| `400 Bad Request` | Invalid client query parameters | `{"statusCode": 400, "message": ["amount must be greater than 0"]}` |
| `502 Bad Gateway` | Upstream currency API timeout, outage, or unsupported code | `{"statusCode": 502, "message": "Unable to retrieve the current exchange rate."}` |
| `500 Internal Server Error` | Database connection error or unexpected fault | `{"statusCode": 500, "message": "An unexpected server error occurred."}` |

---

## 19. External Currency API Information

- **Provider**: [ExchangeRate-API Open Endpoint](https://open.er-api.com/) (`https://open.er-api.com/v6/latest/{currency}`)
- **Why Chosen**: Reliable, high availability, updated regularly, requires no API key or credential rotation, and returns clear standard JSON structures.
- **Timeout**: The client enforces a strict **5-second timeout** (`AbortSignal.timeout(5000)`) to protect the API from hanging requests.
- **Fail-Safe Mapping**: Any upstream HTTP errors, timeouts, or unparseable payloads are intercepted and safely translated to `502 Bad Gateway`.

---

## 20. Testing Instructions

### Run Automated Unit and Integration Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Test Coverage Report
```bash
npm run test:cov
```

All 28 automated tests verify:
1. Valid conversion calculation and persistence
2. Missing `from` parameter
3. Missing `to` parameter
4. Missing `amount` parameter
5. Currency code length not equal to 3
6. Currency code containing non-alphabetic characters
7. Amount equal to 0
8. Negative amount
9. Non-numeric amount
10. Same currency conversion optimization
11. Valid history retrieval with default pagination
12. Custom page and limit pagination
13. Invalid page (page < 1)
14. Invalid limit (limit < 1)
15. Limit exceeding maximum (> 100)
16. External API failure (network error / 500 status)
17. Invalid external API payload structure
18. Database failure handling

---

## 21. Assumptions

1. Currencies follow ISO 4217 standard 3-letter codes. Lowercase inputs (e.g. `usd`, `inr`) are automatically trimmed and normalized to uppercase.
2. Identical currency conversions (`from === to`) do not require external network latency; an exchange rate of `1.0` is used directly while still creating an audit record.
3. Monetary amounts and exchange rates are positive numbers.
4. History queries without explicit pagination parameters default to `page=1` and `limit=10`.

---

## 22. Design Decisions

- **No Over-Engineering**: Direct Controller → Service → Prisma flow without redundant repository layers, use-case wrappers, or complex CQRS patterns.
- **Prisma Decimal vs Floating Points**: Floating-point types in JavaScript (`Number`) suffer from precision artifacts (e.g., `0.1 + 0.2 !== 0.3`). Prisma `Decimal` maps to PostgreSQL `NUMERIC` / `DECIMAL` types to ensure arithmetic precision.
- **Global Validation Pipe**: Set to `whitelist: true`, `transform: true`, and `forbidNonWhitelisted: true` to prevent mass-assignment vulnerabilities.
- **Sanitized Global Filter**: Shields PostgreSQL and Node.js internal stack traces from clients, preventing sensitive credential leaks.

---

## 23. Future Improvements

1. **Redis Caching**: Cache live exchange rates with a short TTL (e.g. 5–15 minutes) to reduce upstream API latency and handle rate limits during high traffic.
2. **Rate Limiting**: Protect endpoints against abuse using `@nestjs/throttler`.
3. **OpenAPI / Swagger**: Add interactive documentation for external consumers.
4. **Health Check Endpoint**: Implement `@nestjs/terminus` for liveness and readiness probes in containerized deployments.
