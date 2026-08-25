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
