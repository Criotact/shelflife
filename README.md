<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/658bc348-0437-4fce-9b52-46167ea7ffce

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Security Considerations

When running ShelfLife with server-side credentials (`ABS_URL` and `ABS_TOKEN` in `.env`), the Express proxy does **not** authenticate incoming requests. Any client that can reach the ShelfLife server can access your Audiobookshelf instance through the proxy.

> **⚠️ Browser Login — Testing Only**
>
> The in-browser login screen stores your credentials and authentication headers in the browser (localStorage). This is **insecure** and intended for development/testing purposes only. For production or any deployment beyond localhost, configure `ABS_URL`, `ABS_TOKEN`, and (optionally) `ABS_EXTRA_HEADERS` in your `.env` file instead of using the browser login.

**Recommendations:**
- Only run in pre-configured mode on trusted local networks.
- If exposing to the internet, place ShelfLife behind a reverse proxy with authentication (e.g. Cloudflare Access, Authelia, or basic auth at the reverse proxy level).
- On Android or untrusted networks, use the login screen (User Login mode), which stores credentials per-device and does not rely on server-side tokens.
