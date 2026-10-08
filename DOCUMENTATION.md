# Currency Converter API — Comprehensive Technical & Interview Guide

Welcome to the comprehensive guide for the **Currency Converter REST API**. This document is specifically written for beginner engineers, pair programmers, and interview candidates who want to understand every design decision, line of code, and architectural concept used in this repository.

---

## 1. What This Project Does

The Currency Converter API is a backend web service that takes an input currency, a target currency, and an amount, converts the value using a live external foreign exchange rates API, calculates the converted amount with financial decimal precision, logs the transaction in a PostgreSQL database for auditing purposes, and provides a paginated history endpoint.

### Complete Request Flow

```
                      [ Client (Browser / cURL / Frontend) ]
                                        │
                                        │ 1. HTTP GET /currency/convert?from=USD&to=INR&amount=100
                                        ▼
                            [ NestJS HTTP Server ]
                                        │
                                        │ 2. Route Matching in CurrencyController
                                        ▼
                            [ NestJS ValidationPipe ]
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
             ▼ Validated & Transformed                             ▼ Invalid
    [ ConvertCurrencyDto ]                               [ 400 Bad Request ]
    - from: "USD"                                        - Abort execution immediately
    - to: "INR"                                          - Return validation errors
    - amount: 100
             │
             │ 3. Delegates execution
             ▼
    [ CurrencyService ]
             │
             ├─────────────────────────────────────────┐
             │ (If from === to: rate = 1.0)            │
             ▼                                         │
    [ Fetch Live Exchange Rate ]                       │
    - Calls open.er-api.com/v6/latest/USD             │
    - 5-second timeout safeguard                       │
             │                                         │
             ├─ Failure / Timeout ──► [ 502 Bad Gateway ]
             │                                         │
             ▼                                         │
    Rate received (e.g., 96.830256)                    │
             │                                         │
             ▼                                         │
    [ Arithmetic Calculation ] ◄───────────────────────┘
    convertedAmount = amount × exchangeRate
    (Computed using Decimal arithmetic)
             │
             │ 4. Persist audit record
             ▼
    [ Prisma ORM Client ]
             │
             │ 5. SQL INSERT
             ▼
    [ PostgreSQL Database ]
    (Table: conversion_history)
             │
             │ 6. Return created entity
             ▼
    [ Clean JSON Serialization ]
             │
             │ 7. HTTP 200 OK
             ▼
         [ Client ]
```

---

## 2. Why NestJS is Used

NestJS is a progressive Node.js framework for building efficient, reliable, and scalable server-side applications. It provides an out-of-the-box architecture that prevents code from becoming messy as projects grow.

### Key NestJS Building Blocks in this Project:

1. **Module (`currency.module.ts`)**:
   - Acts as a container for related controllers and providers.
   - Organizes code into cohesive domain boundaries.
   - Example: `CurrencyModule` bundles `CurrencyController`, `CurrencyService`, and `PrismaService`.

2. **Controller (`currency.controller.ts`)**:
   - Responsible for handling incoming HTTP requests and returning responses.
   - Contains routing decorators like `@Controller('currency')` and `@Get('convert')`.
   - Never contains business logic; it delegates directly to services.

3. **Service (`currency.service.ts`)**:
   - Contains the core business logic: external API communication, rate calculation, and database operations.
   - Marked with `@Injectable()` so NestJS can instantiate and manage it.

4. **Dependency Injection (DI)**:
   - Instead of manually writing `const prisma = new PrismaClient()`, NestJS injects singleton instances through constructors:
     ```typescript
     constructor(
       private readonly prisma: PrismaService,
       private readonly configService: ConfigService,
     ) {}
     ```
   - **Why this matters**: In unit tests, we can easily swap real database connections or network clients with mock objects without altering any business logic.

5. **DTO (Data Transfer Object)**:
   - Defines the exact shape and types of data expected by an endpoint.
   - Combined with validation decorators, it acts as a firewall protecting our application from malicious or malformed inputs.

---

## 3. Why TypeScript is Used

JavaScript is dynamically typed, meaning type errors often only appear at runtime when customers are actively using your application. TypeScript introduces compile-time type checking.

### Practical Benefits in This Project:
- **Compile-Time Safety**: If you accidentally access `data.rates[to]` when `data.rates` might be undefined, TypeScript forces you to handle that possibility.
- **Auto-Completion & Refactoring**: Renaming a field in your DTO or Prisma schema immediately flags all usages across the codebase.
- **Self-Documenting Code**: Type annotations make it immediately obvious what types a method accepts and returns.

---

## 4. Why PostgreSQL

PostgreSQL is an enterprise-grade, open-source relational database management system (RDBMS).

### Why it is appropriate for this project:
- **ACID Compliance**: Guarantees that every conversion saved is committed safely without data loss or corrupted partial writes.
- **Native Fixed-Point Numbers (`NUMERIC` / `DECIMAL`)**: Financial systems require exact decimal arithmetic. PostgreSQL's `DECIMAL(18, 4)` ensures monetary values do not lose precision.
- **B-Tree Indexing**: An index on `created_at` allows instant sorting and fast paginated retrieval of millions of historical conversion logs.

---

## 5. Why Prisma ORM

Prisma is a modern, next-generation Object-Relational Mapper (ORM) for Node.js and TypeScript.

### Core Concepts:
- **`schema.prisma`**: A single declarative source of truth where models, data types, and relationships are defined.
- **Prisma Client (`@prisma/client`)**: An auto-generated, type-safe database client specifically tailored to your schema.
- **Prisma Migrate (`prisma migrate`)**: Automatically generates human-readable SQL migration files tracking changes to your schema over time.
- **Zero Raw SQL Typos**: Methods like `prisma.conversionHistory.findMany()` give full TypeScript auto-completion for column names and where clauses.

---

## 6. Database Design

The application utilizes a single dedicated table: `conversion_history`.

| Column | PostgreSQL Type | Prisma Type | Description | Why It Exists |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `SERIAL PRIMARY KEY` | `Int @id @default(autoincrement())` | Unique integer identifier | Uniquely references each historical conversion record. |
| `from_currency` | `VARCHAR(3)` | `String @map("from_currency") @db.VarChar(3)` | Source currency code | Identifies the starting currency (e.g., `USD`). |
| `to_currency` | `VARCHAR(3)` | `String @map("to_currency") @db.VarChar(3)` | Target currency code | Identifies the destination currency (e.g., `INR`). |
| `amount` | `DECIMAL(18, 4)` | `Decimal @db.Decimal(18, 4)` | Converted input amount | Preserves the exact initial amount entered by the user. |
| `exchange_rate` | `DECIMAL(18, 6)` | `Decimal @map("exchange_rate") @db.Decimal(18, 6)` | Live exchange rate | Captures the exact rate at the moment of conversion. |
| `converted_amount` | `DECIMAL(18, 4)` | `Decimal @map("converted_amount") @db.Decimal(18, 4)` | Result of conversion | Stores the calculated final monetary value. |
| `created_at` | `TIMESTAMP(3)` | `DateTime @default(now()) @map("created_at")` | Transaction timestamp | Essential for chronological sorting, audits, and analytics. |

### Indexes:
- `INDEX ON "conversion_history" ("created_at")`: Allows sorting by `created_at DESC` without scanning the entire table on every paginated query.

---

## 7. Prisma Schema Explained

Here is the complete `prisma/schema.prisma` file annotated:

```prisma
// 1. Datasource block: Defines the database provider (PostgreSQL) and the connection URL from environment variables
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 2. Generator block: Tells Prisma to generate the TypeScript client library
generator client {
  provider = "prisma-client-js"
}

// 3. Model definition: Maps TypeScript model to PostgreSQL table
model ConversionHistory {
  id              Int      @id @default(autoincrement())
  
  // @map maps the TypeScript property 'from' to the snake_case column 'from_currency' in SQL
  from            String   @map("from_currency") @db.VarChar(3)
  to              String   @map("to_currency") @db.VarChar(3)
  
  // Decimal(18, 4) supports up to 18 total digits with 4 fractional decimal places
  amount          Decimal  @db.Decimal(18, 4)
  
  // Decimal(18, 6) allows up to 6 decimal places for high-precision foreign exchange rates
  exchangeRate    Decimal  @map("exchange_rate") @db.Decimal(18, 6)
  convertedAmount Decimal  @map("converted_amount") @db.Decimal(18, 4)
  
  // Automatically defaults to current UTC timestamp when inserted
  createdAt       DateTime @default(now()) @map("created_at")

  // Creates a B-Tree index on createdAt for fast sorting during history pagination
  @@index([createdAt])
  
  // Maps this model to the 'conversion_history' table in PostgreSQL
  @@map("conversion_history")
}
```

---

## 8. API Flow: GET /currency/convert Step by Step

1. **Client Request**: The client issues an HTTP GET request:
   `GET /currency/convert?from=usd&to=inr&amount=100`
2. **Global ValidationPipe Execution**:
   - `class-transformer` converts query string strings into target types (e.g., `"100"` becomes number `100`).
   - The `@Transform` decorator converts `"usd"` to `"USD"`.
   - `class-validator` verifies that `from` and `to` are 3 alphabetic letters and `amount > 0`.
3. **Controller Hand-Off**:
   - `CurrencyController.convert(dto)` receives the strongly-typed DTO.
   - It invokes `this.currencyService.convert(dto)`.
4. **Service Logic**:
   - If `from === to`, the rate is immediately set to `1.0`.
   - Otherwise, the service calls `fetchExchangeRate('USD', 'INR')`.
   - An HTTP GET request is dispatched to `https://open.er-api.com/v6/latest/USD` with a 5000ms timeout.
   - The response is verified: status 200, `result === "success"`, and `rates["INR"]` is a valid number.
5. **Precision Math**:
   - `amountDecimal = new Prisma.Decimal(100)`
   - `rateDecimal = new Prisma.Decimal(96.830256)`
   - `convertedDecimal = amountDecimal.mul(rateDecimal)` -> `9683.0256`
6. **Database Persistence**:
   - `prisma.conversionHistory.create(...)` issues an SQL `INSERT` statement.
7. **JSON Serialization**:
   - The Prisma Decimal objects are formatted to standard JavaScript numbers for JSON serialization.
   - HTTP 200 is returned to the client.

---

## 9. DTO Validation Deep Dive

Validation is enforced using three interconnected tools:
1. **`class-validator`**: Decorators like `@IsNotEmpty()`, `@Length()`, `@Matches()`, `@IsNumber()`, `@IsPositive()`.
2. **`class-transformer`**: Decorators like `@Type(() => Number)` and `@Transform()`.
3. **NestJS `ValidationPipe`**: Configured globally in `main.ts`:
   ```typescript
   new ValidationPipe({
     whitelist: true,          // Strips properties that do not have validation decorators
     transform: true,          // Automatically transforms query string primitives to DTO types
     forbidNonWhitelisted: true // Rejects requests containing unrecognized parameters with 400
   })
   ```

### Invalid Request Scenarios & Error Responses:
- **Missing Required Field (`?from=USD&amount=100`)**:
  - `to currency is required` (`400 Bad Request`)
- **Invalid Currency Length (`?from=USDT&to=INR&amount=100`)**:
  - `from currency must be exactly 3 characters` (`400 Bad Request`)
- **Non-Alphabetic Currency Code (`?from=U12&to=INR&amount=100`)**:
  - `from currency must contain only alphabetic characters` (`400 Bad Request`)
- **Zero or Negative Amount (`?from=USD&to=INR&amount=-10`)**:
  - `amount must be greater than 0` (`400 Bad Request`)
- **Non-Numeric Amount (`?from=USD&to=INR&amount=abc`)**:
  - `amount must be a valid number` (`400 Bad Request`)

---

## 10. External API Integration

### Provider Selected:
**Open Exchange Rates API** (`https://open.er-api.com/v6/latest/{base_currency}`)

### Why Selected:
1. **No API Key Required**: Eliminates registration barriers, rate-limit suspensions for public interview reviewers, and secret-leaking risks.
2. **High Availability**: Backed by ExchangeRate-API infrastructure with multi-region global CDN caching.
3. **Structured Response**: Predictable payload with top-level `result: "success"` and numeric `rates` dictionary.

### Upstream Request & Response:
- **Request**: `GET https://open.er-api.com/v6/latest/USD`
- **Response**:
  ```json
  {
    "result": "success",
    "base_code": "USD",
    "rates": {
      "EUR": 0.92,
      "INR": 83.25,
      "JPY": 154.30
    }
  }
  ```

### Resiliency & Fail-Safe Handling:
- **5-Second Timeout**: Every request passes an `AbortSignal.timeout(5000)`. If the external provider experiences network latency exceeding 5 seconds, the request is aborted immediately.
- **Upstream Error Translation**: Any network failure, HTTP non-200 status, timeout, or malformed payload is intercepted and translated into `502 Bad Gateway`:
  ```json
  {
    "statusCode": 502,
    "message": "Unable to retrieve the current exchange rate."
  }
  ```
  Internal error messages and network URLs are never leaked to clients.

---

## 11. Currency Conversion Calculation

### Core Formula:
$$\text{convertedAmount} = \text{amount} \times \text{exchangeRate}$$

### Simple Example:
$$\text{Amount} = 100 \text{ USD}$$
$$\text{Exchange Rate} = 83.25 \text{ (1 USD = 83.25 INR)}$$
$$\text{Converted Amount} = 100 \times 83.25 = 8325 \text{ INR}$$

### Why Floating-Point Math (`Number`) is Dangerous in Finance:
In standard JavaScript floating-point arithmetic (IEEE 754 standard):
```javascript
0.1 + 0.2 // Returns 0.30000000000000004
```
In financial applications, rounding errors compound over millions of transactions. To prevent this, we calculate using Prisma's underlying `Decimal` arithmetic:
```typescript
const amountDecimal = new Prisma.Decimal(amount);
const rateDecimal = new Prisma.Decimal(exchangeRate);
const convertedDecimal = amountDecimal.mul(rateDecimal);
```
This guarantees exact base-10 mathematical correctness.

---

## 12. History API & Server-Side Pagination

### Endpoint:
`GET /currency/history?page=1&limit=10`

### Parameters:
- `page`: 1-based page index (defaults to 1).
- `limit`: Number of records per page (defaults to 10, maximum allowed is 100).

### Pagination Math:
$$\text{skip} = (\text{page} - 1) \times \text{limit}$$
$$\text{take} = \text{limit}$$
$$\text{totalPages} = \lceil \frac{\text{total}}{\text{limit}} \rceil$$

### Concrete Example:
Suppose the database has **25 total conversion records**:
- **Page 1 (`page=1&limit=10`)**:
  - `skip = (1 - 1) * 10 = 0`
  - `take = 10`
  - Returns records 1 through 10.
  - `totalPages = Math.ceil(25 / 10) = 3`.
- **Page 2 (`page=2&limit=10`)**:
  - `skip = (2 - 1) * 10 = 10`
  - `take = 10`
  - Returns records 11 through 20.
- **Page 3 (`page=3&limit=10`)**:
  - `skip = (3 - 1) * 10 = 20`
  - `take = 10`
  - Returns records 21 through 25.

### Database Efficiency:
The query executes `Promise.all([findMany, count])` concurrently. The records are sorted at the database level by `createdAt: 'desc'` so the newest records appear first.

---

## 13. Error Handling Architecture

The application categorizes all errors into predictable HTTP status codes:

```
                  ┌─────────────────────────────────────────┐
                  │              HTTP Request               │
                  └────────────────────┬────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           Validation Fails                      Validation Passes
        ┌─────────────────────┐               ┌─────────────────────┐
        │   400 Bad Request   │               │   Proceed to Service│
        └─────────────────────┘               └──────────┬──────────┘
                                                         │
                                  ┌──────────────────────┴──────────────────────┐
                                  ▼                                             ▼
                         Upstream API Fails                            Database Crashes
                      ┌─────────────────────┐                       ┌─────────────────────┐
                      │   502 Bad Gateway   │                       │500 Int Server Error │
                      └─────────────────────┘                       └─────────────────────┘
```

1. **`400 Bad Request`**:
   - Triggers when the client sends missing, malformed, or out-of-range query parameters.
2. **`502 Bad Gateway`**:
   - Triggers when the external currency API times out (> 5s), is unreachable, returns HTTP 500, or returns an unsupported currency code.
   - Communicates that the backend is functional, but an upstream dependency failed.
3. **`500 Internal Server Error`**:
   - Triggers on unexpected internal faults (e.g., PostgreSQL connection drops).
   - Sanitized by `HttpExceptionFilter` to prevent database schemas or connection strings from leaking to the caller.

---

## 14. Environment Variables

### Why Secrets Belong in `.env`:
- Hard-coding credentials inside source code risks leaking them to GitHub, public logs, or unauthorized team members.
- The Twelve-Factor App methodology mandates storing configuration in the environment.

### Variables in This Project:
- `DATABASE_URL`: PostgreSQL connection string (user, password, host, port, db name).
- `CURRENCY_API_URL`: Base URL for the foreign exchange provider.
- `PORT`: The local HTTP port the server binds to (default: `3000`).

### `.env` vs `.env.example`:
- `.env`: Contains real local or production credentials. **NEVER committed to Git** (listed in `.gitignore`).
- `.env.example`: A template file containing dummy placeholder values. **Safe to commit to Git** so new developers know what variables are required.

---

## 15. Project Structure Explained

```
src/
├── currency/
│   ├── dto/
│   │   ├── convert-currency.dto.ts  # Declares and validates query params for /currency/convert
│   │   └── history-query.dto.ts     # Declares and validates pagination params for /currency/history
│   ├── currency.controller.ts       # Declares endpoints and delegates to service
│   ├── currency.controller.spec.ts  # HTTP integration tests via Supertest
│   ├── currency.service.ts          # Core conversion logic, external fetch, Decimal math, DB queries
│   ├── currency.service.spec.ts     # Unit tests mocking Prisma and external fetch
│   └── currency.module.ts           # Bundles controller, service, and Prisma into a feature module
├── prisma.service.ts                # Manages connection lifecycle ($connect / $disconnect)
├── http-exception.filter.ts         # Sanitizes errors, catches unhandled exceptions
├── app.module.ts                    # Root module loading ConfigModule and CurrencyModule
└── main.ts                          # Bootstrap script configuring pipes, filters, and port
```

---

## 16. Testing Strategy

The test suite contains **28 automated tests** executed using Jest and Supertest.

### Unit Tests (`currency.service.spec.ts`):
- Mocks database calls and global network requests.
- Validates that rates are correctly multiplied using Decimal arithmetic.
- Confirms that same-currency pairs (`USD` to `USD`) skip network calls and use rate `1`.
- Tests upstream error scenarios (network timeout, 500 status, invalid JSON payload).
- Tests database failure paths.

### Integration / HTTP Tests (`currency.controller.spec.ts`):
- Uses Supertest against the live NestJS `ValidationPipe` and `HttpExceptionFilter`.
- Verifies every status code and response payload across all 18 mandatory project criteria.

### How to Run Tests:
```bash
# Run all tests
npm test

# Run tests with code coverage report
npm run test:cov
```

---

## 17. 25+ Interview Questions & Answers

### 1. Why did you choose NestJS over Express for this project?
- **Interview-Ready Answer**: NestJS provides an opinionated architectural structure out-of-the-box (Modules, Controllers, Services, and Dependency Injection), which prevents spaghetti code and standardizes enterprise TypeScript development.
- **Deeper Explanation**: In vanilla Express, every developer structures routing, validation, and database connections differently. NestJS brings architectural consistency, first-class TypeScript support, built-in dependency injection, and standardized exception handling.
- **Relevant File**: [`src/app.module.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/app.module.ts)

### 2. What is Dependency Injection (DI) and how is it used here?
- **Interview-Ready Answer**: Dependency Injection is an inversion-of-control pattern where a class receives its dependencies from an external framework rather than creating them itself.
- **Deeper Explanation**: In `CurrencyService`, we do not instantiate `new PrismaClient()`. Instead, NestJS injects a singleton `PrismaService` into the constructor. This decouples our service from the database and allows us to pass mock implementations in unit tests.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 3. What is a DTO and why not just read `req.query` directly?
- **Interview-Ready Answer**: A DTO (Data Transfer Object) defines a strict contract for incoming data. It enables automatic runtime validation and transformation before the request reaches business logic.
- **Deeper Explanation**: In plain Express, you would have to write manual `if (!req.query.from || req.query.from.length !== 3)` checks inside your controller. DTOs encapsulate these rules declaratively using decorators.
- **Relevant File**: [`src/currency/dto/convert-currency.dto.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/dto/convert-currency.dto.ts)

### 4. How does `ValidationPipe` work under the hood?
- **Interview-Ready Answer**: `ValidationPipe` utilizes `class-transformer` to convert raw incoming query strings into typed class instances, and `class-validator` to execute validation decorator rules, throwing a `400 Bad Request` if any fail.
- **Deeper Explanation**: In `main.ts`, we configure `whitelist: true` (stripping unexpected properties) and `forbidNonWhitelisted: true` (rejecting requests with extra parameters to prevent parameter tampering).
- **Relevant File**: [`src/main.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/main.ts)

### 5. Why use PostgreSQL instead of MongoDB for this project?
- **Interview-Ready Answer**: Financial transaction history is structured tabular data that benefits from relational integrity, ACID compliance, and native fixed-point Decimal types.
- **Deeper Explanation**: PostgreSQL enforces schema constraints (e.g. `VARCHAR(3)`, `DECIMAL(18, 4)`) at the database level and provides efficient B-tree indexing for timestamp-based pagination.
- **Relevant File**: [`prisma/schema.prisma`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/prisma/schema.prisma)

### 6. Why use Prisma ORM instead of TypeORM or raw SQL?
- **Interview-Ready Answer**: Prisma offers type safety generated directly from the schema, intuitive migrations, and a clean API without the boilerplate and entity mapping bugs common in TypeORM.
- **Deeper Explanation**: When you run `prisma generate`, Prisma creates a TypeScript client where all database models and field names match your schema. If a column name changes, TypeScript catches errors at compile time.
- **Relevant File**: [`prisma/schema.prisma`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/prisma/schema.prisma)

### 7. Why use Decimal instead of floating-point Number for monetary values?
- **Interview-Ready Answer**: JavaScript numbers use IEEE 754 double-precision floating-point format, which causes binary rounding inaccuracies like `0.1 + 0.2 !== 0.3`.
- **Deeper Explanation**: In financial calculations, rounding errors accumulate into real monetary discrepancies. Prisma's `Decimal` type provides arbitrary-precision decimal arithmetic.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 8. Why do we return HTTP 502 Bad Gateway instead of 500 when the external currency API fails?
- **Interview-Ready Answer**: HTTP 502 specifically denotes that a server, while acting as a gateway or proxy, received an invalid response from an inbound upstream server.
- **Deeper Explanation**: A 500 status implies our own code or database crashed. A 502 accurately informs monitoring systems and clients that our application is healthy, but an external third-party dependency is failing.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 9. How do you prevent the external API call from hanging our server?
- **Interview-Ready Answer**: We enforce a 5-second timeout on the HTTP request using `AbortSignal.timeout(5000)`.
- **Deeper Explanation**: Without a timeout, a lagging upstream provider could keep sockets open indefinitely, eventually exhausting Node.js event loop resources and degrading server throughput.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 10. How is same-currency conversion (`USD` to `USD`) handled?
- **Interview-Ready Answer**: It is resolved directly in `CurrencyService` with an exchange rate of `1.0` without making an external network call, while still logging the record in the database.
- **Deeper Explanation**: Skipping external network latency saves bandwidth, avoids external rate limits, and improves response time from ~200ms to <10ms.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 11. How does pagination work in the history endpoint?
- **Interview-Ready Answer**: It uses offset-based pagination via Prisma's `skip` and `take` clauses: `skip = (page - 1) * limit` and `take = limit`.
- **Deeper Explanation**: We execute `findMany` and `count` concurrently using `Promise.all` to fetch both the current page of data and the total record count needed to calculate `totalPages`.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 12. Why set a maximum limit of 100 on pagination?
- **Interview-Ready Answer**: To prevent Denial of Service (DoS) attacks or high memory consumption caused by malicious requests like `?limit=1000000`.
- **Deeper Explanation**: Fetching thousands of rows at once locks database connections and consumes Node.js memory. Capping the limit at 100 ensures predictable query execution times.
- **Relevant File**: [`src/currency/dto/history-query.dto.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/dto/history-query.dto.ts)

### 13. Why use `Promise.all` for history pagination?
- **Interview-Ready Answer**: To run the record retrieval query and the total count query concurrently rather than sequentially.
- **Deeper Explanation**: Sequential queries double database round-trip latency. `Promise.all` allows PostgreSQL to process both queries simultaneously over available connection pool connections.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 14. What is the role of `HttpExceptionFilter`?
- **Interview-Ready Answer**: It intercepts all exceptions across the application, standardizes the error response format, and prevents internal stack traces or database credentials from leaking to clients.
- **Deeper Explanation**: For `HttpException` instances (like 400 or 502), it formats the message cleanly. For unhandled errors, it logs the stack trace internally for developers and returns a safe `500 Internal Server Error` to the client.
- **Relevant File**: [`src/http-exception.filter.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/http-exception.filter.ts)

### 15. How do you protect secrets and configuration?
- **Interview-Ready Answer**: Secrets are stored in `.env` and loaded via `@nestjs/config`. `.env` is ignored by Git, and only `.env.example` with dummy values is committed.
- **Deeper Explanation**: No credentials, database URLs, or API keys are ever hard-coded in source files.
- **Relevant File**: [`.gitignore`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/.gitignore) and [`.env.example`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/.env.example)

### 16. Why normalize currency codes to uppercase?
- **Interview-Ready Answer**: Currency codes are standardized in ISO 4217 as 3 uppercase letters (e.g. `USD`). Normalizing input like `usd` to `USD` provides a better developer experience and prevents duplicate database entries.
- **Deeper Explanation**: We use `@Transform(({ value }) => value.trim().toUpperCase())` directly inside the DTO so downstream service logic always handles uniform strings.
- **Relevant File**: [`src/currency/dto/convert-currency.dto.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/dto/convert-currency.dto.ts)

### 17. Why do we index the `created_at` column in PostgreSQL?
- **Interview-Ready Answer**: Because history queries sort by `created_at DESC`. An index allows the database to retrieve rows in sorted order in logarithmic time $O(\log n)$ rather than performing an expensive full-table sort $O(n \log n)$.
- **Deeper Explanation**: Without an index, as the table grows to millions of records, pagination queries would become sluggish and cause high CPU spikes.
- **Relevant File**: [`prisma/schema.prisma`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/prisma/schema.prisma)

### 18. What happens if the database goes down during a conversion request?
- **Interview-Ready Answer**: The transaction cannot be saved, so `CurrencyService` catches the database error and throws an `InternalServerErrorException` (`500`).
- **Deeper Explanation**: The client receives a sanitized error payload: `{"statusCode": 500, "message": "Failed to save conversion to database."}`.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 19. Why don't we hard-code exchange rates?
- **Interview-Ready Answer**: Foreign exchange rates fluctuate continuously throughout the trading day. Hard-coded rates would quickly become inaccurate and cause financial losses.
- **Deeper Explanation**: Real-world currency applications must query dynamic live rates from foreign exchange markets or central banking feeds.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 20. How do you test the application without hitting the real database or external API?
- **Interview-Ready Answer**: By using Jest to mock `PrismaService` and `global.fetch`.
- **Deeper Explanation**: In `currency.service.spec.ts`, we mock `conversionHistory.create` and `fetch`. This ensures unit tests execute in milliseconds, are deterministic, and do not fail if the external API is offline.
- **Relevant File**: [`src/currency/currency.service.spec.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.spec.ts)

### 21. What is the difference between unit tests and integration tests in this project?
- **Interview-Ready Answer**: Unit tests test `CurrencyService` in isolation by mocking dependencies; integration tests use Supertest to test the entire HTTP pipeline, including routing, `ValidationPipe`, and exception filters.
- **Deeper Explanation**: Unit tests verify business logic calculations, while integration tests verify that HTTP query parameters like `?amount=-5` actually return HTTP 400 to the client.
- **Relevant Files**: [`src/currency/currency.service.spec.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.spec.ts) and [`src/currency/currency.controller.spec.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.controller.spec.ts)

### 22. What happens if a client passes an unsupported currency code like `XYZ`?
- **Interview-Ready Answer**: The code passes 3-letter regex validation, but the external provider returns an error payload indicating unsupported currency. The service detects this and throws `502 Bad Gateway`.
- **Deeper Explanation**: The service checks `data.result === 'success'` and verifies that `rates[to]` is a number. If not, it safely aborts.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 23. Why didn't you add repository abstractions or use-case layers?
- **Interview-Ready Answer**: For this scope of application, extra layers add unnecessary boilerplate without providing tangible architectural benefits. Prisma already acts as the repository abstraction.
- **Deeper Explanation**: Over-engineering simple CRUD and API proxying leads to bloated codebases. Keeping a clean Controller → Service → Prisma flow makes the codebase maintainable, readable, and easy to explain.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

### 24. How would you handle high traffic in production?
- **Interview-Ready Answer**: Introduce Redis caching for live exchange rates with a 5-to-15 minute TTL and implement cursor-based pagination for history queries.
- **Deeper Explanation**: Exchange rates do not change every millisecond. Caching exchange rates in Redis reduces upstream API requests by 99% and drops response times to sub-5ms.
- **Relevant File**: [`README.md`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/README.md#23-future-improvements)

### 25. How do you serialize Decimal values to JSON without returning string representations or Decimal objects?
- **Interview-Ready Answer**: We explicitly map Prisma `Decimal` instances using `Number(record.amount)` before returning the response.
- **Deeper Explanation**: Prisma Decimal instances serialize to strings by default to prevent precision loss in JSON. In our service, we convert them to numbers so the output matches the required numeric API schema.
- **Relevant File**: [`src/currency/currency.service.ts`](file:///c:/Users/dd714/OneDrive/Desktop/Repo/currency-cnverter-api/src/currency/currency.service.ts)

---

## 18. Code Walkthrough by File

### 1. `src/main.ts`
- **Purpose**: Application entrypoint.
- **Key Logic**: Creates the NestJS application instance, registers the global `ValidationPipe` with whitelist and transform settings, applies `HttpExceptionFilter`, and listens on `PORT`.

### 2. `src/app.module.ts`
- **Purpose**: Root module.
- **Key Logic**: Imports `ConfigModule.forRoot({ isGlobal: true })` to load `.env` variables globally and registers `CurrencyModule`.

### 3. `src/currency/currency.module.ts`
- **Purpose**: Feature module.
- **Key Logic**: Bundles `CurrencyController`, `CurrencyService`, and `PrismaService` into an isolated domain module.

### 4. `src/currency/currency.controller.ts`
- **Purpose**: HTTP route handling.
- **Key Logic**: Defines `GET /currency/convert` and `GET /currency/history`. Injects `CurrencyService` and delegates requests to it.

### 5. `src/currency/currency.service.ts`
- **Purpose**: Core business and data logic.
- **Key Logic**:
  - `fetchExchangeRate()`: Queries `open.er-api.com` with a 5s timeout and error handling.
  - `convert()`: Handles same-currency check, executes Decimal arithmetic, saves record in PostgreSQL, and formats JSON.
  - `getHistory()`: Executes concurrent `findMany` and `count` queries to return paginated audit data.

### 6. `src/currency/dto/convert-currency.dto.ts`
- **Purpose**: Query parameter validation for conversion.
- **Key Logic**: `@Length(3, 3)`, `@Matches(/^[A-Z]{3}$/)`, `@Transform()` to uppercase, `@IsPositive()` for amounts.

### 7. `src/currency/dto/history-query.dto.ts`
- **Purpose**: Query parameter validation for pagination.
- **Key Logic**: `@IsInt()`, `@Min(1)` for page, `@Max(100)` for limit.

### 8. `prisma/schema.prisma`
- **Purpose**: Database schema definition.
- **Key Logic**: Configures PostgreSQL connection, generates Prisma Client, and defines `ConversionHistory` model with `Decimal(18, 4)` and `Decimal(18, 6)` fields.

---

## 19. How to Explain This Project in an Interview

### 60-Second Elevator Pitch:
> "I built a production-style Currency Converter REST API using NestJS, TypeScript, PostgreSQL, and Prisma ORM. The API converts currencies using a live public exchange rates API, handles same-currency conversions instantly, calculates values with fixed-point Decimal precision to prevent floating-point rounding errors, and persists every successful conversion into PostgreSQL. It also provides a server-side paginated history endpoint. All inputs are strictly validated using class-validator DTOs, upstream failures gracefully map to HTTP 502 Bad Gateway with timeouts, and sensitive credentials are fully protected in environment variables. The project includes 100% test coverage across 28 automated unit and integration tests."

---

### 2-Minute Explanation:
> "The goal of this project was to build a clean, reliable, and interview-ready Currency Converter API without unnecessary over-engineering.
>
> Architecturally, it follows a clean NestJS pattern: Controller to Service to Prisma.
>
> When a client calls `/currency/convert`, the request first passes through a global ValidationPipe. The DTO validates that currency codes are 3-letter alphabetic ISO codes and automatically trims and normalizes them to uppercase, while verifying that the amount is a positive number.
>
> In the service layer, if both currencies are identical—like USD to USD—we skip the external API call and resolve with rate 1.0. For different currencies, we fetch live rates from an external open exchange-rates provider with a strict 5-second timeout. Any upstream outage or malformed response is caught and translated to a clean 502 Bad Gateway.
>
> For math, we use Prisma's Decimal type to eliminate standard JavaScript floating-point inaccuracies. Once calculated, the conversion is saved to a PostgreSQL database table called `conversion_history`.
>
> For history, we implemented server-side pagination with skip and take, capped at a maximum of 100 records per page to prevent denial of service. It executes both the records lookup and total count concurrently using Promise.all and sorts by newest records first using an index on `created_at`.
>
> Finally, I wrote 28 unit and integration tests covering all validation rules, edge cases, external API errors, and database failures."

---

### Detailed Technical Explanation:
> "From an engineering perspective, this project was designed around three pillars: precision, resilience, and simplicity.
>
> First, on **precision**: We avoid native JavaScript Numbers during multiplication because binary floating-point representation causes precision loss in monetary calculations. In the database, we configured PostgreSQL `DECIMAL(18, 4)` for amounts and `DECIMAL(18, 6)` for exchange rates. In the service, calculations are performed using `Prisma.Decimal.mul()`.
>
> Second, on **resilience and error handling**: Third-party APIs are inherently prone to latency spikes and outages. We wrap our fetch calls with `AbortSignal.timeout(5000)` to ensure the event loop is never blocked. Upstream failures are caught and surfaced as `502 Bad Gateway` rather than generic 500 errors. Furthermore, a global `HttpExceptionFilter` ensures that unexpected database errors never leak SQL queries, connection strings, or stack traces to clients.
>
> Third, on **performance and database design**: The conversion history table features a B-tree index on `created_at`. In the history endpoint, we calculate `skip = (page - 1) * limit` and `take = limit`, running the data retrieval and total count in parallel via `Promise.all`. This allows PostgreSQL to utilize connection pooling and index scans rather than sequential table scans.
>
> In terms of code quality, we avoided over-engineering: no redundant repository or use-case abstractions, no unnecessary factory patterns. The entire codebase is strongly typed in TypeScript with zero `any` types, full validation via class-validator DTOs, and validated by 28 automated Jest and Supertest tests."
