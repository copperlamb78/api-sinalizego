## 2026-08-23 - Prevent User Enumeration in Login
**Vulnerability:** Username/Email Enumeration via Login Error Messages.
**Learning:** The login endpoint previously returned distinct error messages for "User not found" (`NotFoundException`) and "Invalid password" (`UnauthorizedException`), allowing an attacker to determine if an email exists in the database.
**Prevention:** Unified the error response to a generic `UnauthorizedException('Credenciais inválidas')` for both non-existent users and incorrect passwords. Always use generic error messages for authentication failures.
