## 2026-08-26 - Missing Centralized Environment Variables Validation
**Vulnerability:** Several critical environment variables (like API keys and encryption secrets) were checked sporadically at runtime across different services, or insecurely fell back to other secrets (e.g. `ENCRYPTION_SECRET` falling back to `JWT_SECRET`).
**Learning:** This fragmented validation approach leads to "fail-open" behaviors or runtime crashes deeply buried in business logic, and reusing secrets severely compromises separation of concerns.
**Prevention:** Always centralize environment variable validation at application startup using tools like `@nestjs/config` alongside `class-validator`. By enforcing validation synchronously during bootstrap, the application will "fail securely" (refuse to start) if any critical configuration is missing. For test suites, maintain a global `jest-setup.js` file to safely mock these variables and prevent test regressions.
## 2026-08-23 - Prevent User Enumeration in Login
**Vulnerability:** Username/Email Enumeration via Login Error Messages.
**Learning:** The login endpoint previously returned distinct error messages for "User not found" (`NotFoundException`) and "Invalid password" (`UnauthorizedException`), allowing an attacker to determine if an email exists in the database.
**Prevention:** Unified the error response to a generic `UnauthorizedException('Credenciais inválidas')` for both non-existent users and incorrect passwords. Always use generic error messages for authentication failures.

## 2026-08-23 - Hardcoded Fallback Secrets
**Vulnerability:** Hardcoded encryption secrets in code.
**Learning:** `src/helpers/crypto.helper.ts` and `src/modules/auth/auth.service.ts` had fallback secrets (e.g. `'sinalizego-fallback-encryption-secret-32b'`, `'jwt_secret'`) in case environment variables were missing. This is a critical risk, as an attacker with codebase access could decrypt sensitive data if those fallbacks were inadvertently used in production.
**Prevention:** Instead of providing hardcoded fallbacks, fail securely. Throw an explicit error during initialization or execution if required security-related environment variables (`ENCRYPTION_SECRET`, `JWT_SECRET`) are missing.

## 2026-08-25 - [Medium] Fix Information Disclosure in Error Filter
**Vulnerability:** The global exception filter (`AllExceptionsFilter`) was blindly returning the raw exception message to the client for unhandled `Error` instances (`message = exception.message || message;`). This can leak sensitive internal server details, database paths, or stack traces.
**Learning:** Always provide a sanitized, generic error message to end users for 500 Internal Server Errors while logging the real exception securely internally.
**Prevention:** Ensure global error handlers do not override the generic fallback message with raw exception messages for unexpected errors.
## 2024-05-20 - Prevent Log Injection and Data Leakage
**Vulnerability:** Use of raw `console.error` and uncontrolled logging in integration points (`AsaasService`), potentially leaking sensitive data like API keys, secrets, or causing circular reference crashes when dealing with complex Error objects (e.g., from Axios).
**Learning:** `console.error` lacks context, doesn't format well in production log aggregators, and using `JSON.stringify` on raw error objects without sanitization can expose headers/tokens or crash due to circular references.
**Prevention:** Use the application's structured logger (`this.logger.error`). Always sanitize error objects by selectively extracting safe properties (`response.data`, `message`, etc.). When logging exceptions in NestJS, always pass the message as the first parameter and the `error.stack` as the second parameter to retain standard formatting.
## 2024-05-18 - [Prevent Information Disclosure on 500 Errors]
**Vulnerability:** Global exception handler (`AllExceptionsFilter`) returned raw error messages from `HttpException` instances throwing 500 status codes (e.g. `InternalServerErrorException`) straight to the client, leading to potential sensitive internal application/system information disclosure.
**Learning:** Global error handlers must explicitly catch and obscure 500 errors separately from standard HTTP status overrides, even if the error originates from standard framework exceptions.
**Prevention:** Ensured the exception filter traps `HttpStatus.INTERNAL_SERVER_ERROR`, safely logs the original error details server-side via logger, and returns a generic obfuscated fallback message client-side.
