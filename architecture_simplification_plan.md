# Architectural Simplification Plan: Stateless CORS Gateway

This document serves as a blueprint for refactoring the **ShelfLife** codebase. It outlines the current connection logic and details a simplified, secure, and state-free backend architecture.

---

## 1. Summary of Current Connection Logic

Currently, ShelfLife supports a dual-connection model across two platforms: **Web (Browser)** and **Android (Native via Capacitor)**.

### The Two Modes
1. **Proxy Mode (`isDirect: false`)**: 
   * **Purpose:** Single-tenant, administrator-preconfigured access.
   * **Credentials:** Read securely on the backend server from environment variables (`ABS_URL` and `ABS_TOKEN`).
   * **Web Behavior:** Browser requests relative path `/api/abs`. The Express server automatically injects credentials and proxies the request to the target server.
   * **Android Behavior:** Dev fallback pointing to `http://localhost/api`.

2. **Direct Mode (`isDirect: true`)**:
   * **Purpose:** Multi-tenant client access. The user enters their own custom server URL and credentials in the login form.
   * **Credentials:** Saved on the client side in local storage (web) or preferences (Android).
   * **Web Behavior:** Subject to browser CORS restrictions. To bypass CORS, the client sends requests to the local server relative path `/api/abs` but includes an envelope header containing the actual target URL: `X-ABS-URL: https://custom-user-server.com`. The local Express server intercepts this request, unpacks the header, and dynamically forwards the request to the target URL.
   * **Android Behavior:** Bypasses CORS completely due to native platform capabilities. The client connects **100% directly** to the user's remote server (`https://custom-user-server.com/api`) without passing any traffic through the ShelfLife backend.

### Current Backend Complexity
To support this dual routing model, the current Express backend (`server.ts`) handles:
* Parsing custom incoming headers (`X-ABS-URL`, `X-ABS-Extra-Headers`).
* Dynamic proxy re-routing via `http-proxy-middleware`'s router option.
* Custom, complex endpoints to handle logins (`/api/abs/login`), recent item aggregations (`/api/abs/recent`), and chapter lookup proxies.
* Custom cover routing overrides inside `/metadata`.
* In-memory session caches tied to client targets.

---

## 2. Greenfield Target Architecture: "Stateless CORS Gateway"

By shifting 100% of the Audiobookshelf business logic to the frontend client, the backend can be stripped of all custom routes and turned into a simple, secure, and stateless pass-through proxy.

```
┌─────────────────────────────────────────────────────────────┐
│                 Client (Web App / Android)                  │
│                                                             │
│  • Manages all ABS state (libraries, sessions, covers)     │
│  • Performs recent-activity aggregations client-side        │
│  • Sends Target Destination in 'X-Target-URL' header        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     Web App (Through Proxy)               Android (Direct)
               │                              │
               ▼                              ▼
┌──────────────────────────────┐       ┌─────────────┐
│   ShelfLife Express Proxy    │       │  Internet   │
│                              │       │             │
│  • Strips X-Target-URL       │       │  • Direct   │
│  • Securely injects .env     │       │    Request  │
│    creds if no auth sent     │       │             │
└──────────────┬───────────────┘       └──────┬──────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Target Audiobookshelf Server                  │
└─────────────────────────────────────────────────────────────┘
```

### The New Gateway Design:
1. **No custom ABS endpoints:** Delete `/api/abs/login`, `/api/abs/recent`, `/api/abs/sessions`, etc.
2. **Client-side Autonomy:** The React client (`src/lib/api.ts`) aggregates libraries and handles chapters lookup directly, using a unified API client.
3. **Secure Header Injection:** The backend proxy dynamically resolves the destination. If the client did not send an explicit destination header, the proxy securely injects the `.env` parameters (`ABS_URL` and `ABS_TOKEN`) inside the server environment. **The browser never sees the private token.**

---

## 3. Ready-To-Use Hand-off Prompt for the Next AI Developer

*Copy and paste the prompt below into your next chat to have an AI agent execute this refactoring.*

```markdown
We want to simplify the ShelfLife backend and frontend architecture by moving to a "Stateless CORS Gateway" model. 

Please perform the following refactoring steps:

### 1. Refactor the Backend (server.ts)
We want to remove all Audiobookshelf-specific custom endpoints and keep the backend entirely stateless.
- Delete custom routes: `/api/abs/health`, `/api/abs/login`, `/api/abs/recent`, and `/api/abs/sessions`.
- Delete the in-memory `sessionsCache`.
- Replace the complex `/api/abs` and `/metadata` proxy middlewares with a single generic gateway endpoint `/gateway`:
  - It must read the target URL from an incoming header: `x-target-url`.
  - If `x-target-url` exists, route the proxy request to that destination.
  - If `x-target-url` does NOT exist, fall back to the server's environment variable `process.env.ABS_URL`.
  - On outbound proxying (in the `proxyReq` hook):
    - Remove the temporary `x-target-url` header so it doesn't leak upstream.
    - If the incoming request has NO `Authorization` header, securely inject `Authorization: Bearer <ABS_TOKEN>` using the server's environment variable `process.env.ABS_TOKEN`.
    - If it already has an `Authorization` header, pass it through untouched (this is for custom client logins).

### 2. Refactor the Frontend Client (src/lib/api.ts)
The frontend must become the single source of truth for all network routes:
- Update the API Client base routing logic:
  - If running in a browser (`!Capacitor.isNativePlatform()`), all API calls must go through `/gateway`.
    - If the user has saved credentials, append `X-Target-URL: <saved_url>` and `Authorization: Bearer <saved_token>` headers.
    - If the user has NO saved credentials, do not append `X-Target-URL` or `Authorization` headers (letting the backend proxy securely inject the `.env` credentials).
  - If running on Android (`Capacitor.isNativePlatform()`), all API calls go directly to the target URL (`<saved_url>/api`) with standard headers, bypassing `/gateway` completely.
- Consolidate business logic:
  - Keep the client-side library item aggregation inside `getRecentItems()` and ensure it is always used, removing any paths pointing to `/recent`.
  - Clean up any dynamic cover-image parameters that are no longer needed.

### 3. Verify and Test
- Run `npm run lint` and ensure there are no TypeScript compiler errors.
- Validate that both Web (static and logged-in connection) and Android connection paths build correctly.
```
