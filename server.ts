import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { IncomingMessage } from "http";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  let ABS_URL = process.env.ABS_URL || "";
  if (ABS_URL.endsWith('/')) {
    ABS_URL = ABS_URL.slice(0, -1);
  }
  const ABS_TOKEN = process.env.ABS_TOKEN;

  // Parse optional extra headers (e.g. Cloudflare Access service tokens)
  let envExtraHeaders: Record<string, string> = {};
  if (process.env.ABS_EXTRA_HEADERS) {
    try {
      envExtraHeaders = JSON.parse(process.env.ABS_EXTRA_HEADERS);
      console.log(`Extra headers loaded from env: ${Object.keys(envExtraHeaders).join(", ")}`);
    } catch {
      console.error("WARNING: ABS_EXTRA_HEADERS is not valid JSON — ignoring.");
    }
  }

  if (!ABS_URL || !ABS_TOKEN) {
    console.error("WARNING: Audiobookshelf URL and Token are not configured.");
  }

  // Parse client-supplied extra headers forwarded as X-ABS-Extra-Headers JSON
  // Accepts both express.Request and raw IncomingMessage (used in proxy callbacks)
  function parseClientExtraHeaders(req: { headers: IncomingMessage['headers'] }): Record<string, string> {
    const raw = req.headers['x-abs-extra-headers'];
    if (!raw || typeof raw !== 'string') return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  // Helper function for the few routes we need to intercept
  function getAbsApi(req: express.Request) {
    const xAbsUrl = req.headers['x-abs-url'] || ABS_URL;
    const clientAuth = req.headers['authorization'];
    
    const targetUrl = typeof xAbsUrl === 'string' && xAbsUrl.endsWith('/') ? xAbsUrl.slice(0, -1) : xAbsUrl;
    
    // Merge: env-level extra headers baseline, then client-supplied overrides
    const clientExtra = parseClientExtraHeaders(req);
    const headers: Record<string, string> = {
      ...envExtraHeaders,
      ...clientExtra,
    };
    if (clientAuth) {
      headers['Authorization'] = typeof clientAuth === 'string' ? clientAuth : '';
    } else if (ABS_TOKEN) {
      headers['Authorization'] = `Bearer ${ABS_TOKEN}`;
    }

    // Diagnostic logging of forwarded headers (safely masked)
    const extraKeys = Object.keys(headers).filter(k => k.toLowerCase() !== 'authorization');
    const maskedInfo = extraKeys.length > 0 
      ? extraKeys.map(k => `${k}: (${headers[k] ? '••••' + String(headers[k]).slice(-4) : 'empty'})`).join(', ')
      : 'none';
    console.log(`[ABS API Client] Intercepting request to ${targetUrl}. Extra headers: [${maskedInfo}]`);

    const apiInstance = axios.create({
      baseURL: targetUrl as string,
      headers
    });

    apiInstance.interceptors.response.use((response) => {
      const contentType = response.headers?.['content-type'];
      const contentTypeStr = typeof contentType === 'string' ? contentType : '';
      if (
        contentTypeStr.includes('text/html') ||
        (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE'))
      ) {
        throw new Error('Upstream returned HTML instead of JSON. This typically indicates a Cloudflare Access or authentication gateway challenge.');
      }
      return response;
    });

    return apiInstance;
  }

  // Format dynamic proxy error messages nicely
  function formatError(error: any): string {
    const msg = error?.message || String(error);
    if (msg.includes("EPROTO") || msg.includes("SSL routines") || msg.includes("tls_get_more_records") || msg.includes("WRONG_VERSION_NUMBER")) {
      return "SSL/TLS Protocol Error: Attempted secure connection (https://) to a non-secure (http://) server. Please change the URL scheme to http://";
    }
    return msg;
  }

  // Custom proxy route for health check (ping)
  app.get("/api/abs/health", async (req, res) => {
    try {
      const api = getAbsApi(req);
      const response = await api.get("ping");
      res.json(response.data);
    } catch (error: any) {
      console.error("Health check failed:", error.message);
      res.json({ error: formatError(error), status: error.response?.status });
    }
  });

  // Custom proxy route for login (targets root level /login)
  app.post("/api/abs/login", express.json(), async (req, res) => {
    try {
      const { username, password } = req.body;
      const xAbsUrl = req.headers['x-abs-url'] || ABS_URL;
      const targetUrl = typeof xAbsUrl === 'string' && xAbsUrl.endsWith('/') ? xAbsUrl.slice(0, -1) : xAbsUrl;
      
      // Include extra headers (env + client-supplied) so CF-protected servers accept the login request
      const extraHeaders = {
        ...envExtraHeaders,
        ...parseClientExtraHeaders(req),
      };

      const response = await axios.post(
        `${targetUrl}/login`,
        { username, password },
        {
          headers: {
            "Content-Type": "application/json",
            ...extraHeaders,
          },
          timeout: 8000
        }
      );

      const contentType = response.headers?.['content-type'];
      const contentTypeStr = typeof contentType === 'string' ? contentType : '';
      if (
        contentTypeStr.includes('text/html') ||
        (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE'))
      ) {
        throw new Error('Upstream returned HTML instead of JSON. This typically indicates a Cloudflare Access or authentication gateway challenge.');
      }

      res.json(response.data);
    } catch (error: any) {
      console.error("Login proxy failed:", error.message);
      res.status(error.response?.status || 500).json({ error: formatError(error) });
    }
  });

  // Custom proxy route for recent items (fetches from all libraries)
  app.get("/api/abs/recent", async (req, res) => {
    try {
      const api = getAbsApi(req);
      const libRes = await api.get("api/libraries");
      const libraries = libRes.data?.libraries || [];
      
      if (libraries.length === 0) {
        return res.json({ results: [] });
      }

      // Fetch recent items from all libraries and merge them
      const recentItemsPromises = libraries.map((lib: any) => 
        api.get(`api/libraries/${lib.id}/items?limit=10&sort=addedAt&desc=1`)
          .then(res => ({ results: res.data.results || [], total: res.data.total || 0 }))
          .catch(() => ({ results: [], total: 0 }))
      );

      const allRecentResults = await Promise.all(recentItemsPromises);
      const totalBooks = allRecentResults.reduce((acc, r) => acc + r.total, 0);
      const flattened = allRecentResults.flatMap(r => r.results);
      
      // Sort the merged list by addedAt descending
      const sorted = flattened.sort((a: any, b: any) => b.addedAt - a.addedAt);
      
      // Return the top 10 most recent across all libraries + total count
      res.json({ results: sorted.slice(0, 10), totalBooks });
    } catch (error: any) {
      console.error("Failed to fetch recent items:", error.message);
      res.status(error.response?.status || 500).json({ error: formatError(error) });
    }
  });

  // In-memory cache for sessions standard query, keyed by target URL and auth signature
  let sessionsCache: Record<string, { data: any; timestamp: number }> = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  app.get("/api/abs/sessions", async (req, res) => {
    try {
      const { itemsPerPage, sort, desc, bypassCache } = req.query;
      const isStandardQuery = itemsPerPage === "500" && sort === "startedAt" && desc === "1";
      const shouldBypass = bypassCache === "true";

      const xAbsUrl = req.headers['x-abs-url'] || ABS_URL;
      const clientAuth = req.headers['authorization'] || '';
      
      // Build a robust cache key combining target host URL and authorization token signature to prevent cross-auth cache leakage
      const hostPart = typeof xAbsUrl === 'string' ? xAbsUrl : 'default';
      const authPart = typeof clientAuth === 'string' ? clientAuth.slice(-12) : ''; // Use last few chars as a safe non-sensitive signature
      const cacheKey = `${hostPart}_${authPart}`;
      
      const cached = sessionsCache[cacheKey];

      if (isStandardQuery && !shouldBypass && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[Sessions Proxy] Returning cached sessions data for host signature ${hostPart} (${authPart ? 'auth: ok' : 'no auth'})`);
        return res.json(cached.data);
      }

      console.log(`[Sessions Proxy] Fetching fresh sessions from: ${hostPart}/api/sessions`);
      const api = getAbsApi(req);
      const response = await api.get("api/sessions", { params: req.query });

      // Diagnostic logging of response data structure
      const isArray = Array.isArray(response.data);
      const hasSessionsProp = response.data && typeof response.data === 'object' && 'sessions' in response.data;
      const sessionsLength = isArray 
        ? response.data.length 
        : (hasSessionsProp && Array.isArray(response.data.sessions) ? response.data.sessions.length : 0);
      
      console.log(`[Sessions Proxy] RAW RESPONSE DATA TYPE: ${isArray ? 'Array' : typeof response.data}`);
      console.log(`[Sessions Proxy] RAW RESPONSE KEYS: ${response.data && typeof response.data === 'object' ? Object.keys(response.data).join(', ') : 'none'}`);
      console.log(`[Sessions Proxy] Successfully retrieved sessions (${sessionsLength} items)`);

      if (isStandardQuery) {
        sessionsCache[cacheKey] = {
          data: response.data,
          timestamp: Date.now()
        };
      }

      res.json(response.data);
    } catch (error: any) {
      console.error("[Sessions Proxy] Failed to fetch sessions:", error.message);
      if (error.response) {
        console.error(`[Sessions Proxy] Upstream status code: ${error.response.status}`);
        console.error("[Sessions Proxy] Upstream response headers:", error.response.headers);
        console.error("[Sessions Proxy] Upstream response data:", error.response.data);
      }
      res.status(error.response?.status || 500).json({ error: formatError(error) });
    }
  });

  app.get("/api/abs/chapters/lookup", async (req, res) => {
    try {
      const { asin, region } = req.query;
      if (!asin) {
        return res.status(400).json({ error: "ASIN is required" });
      }
      const params = new URLSearchParams();
      if (region && typeof region === "string") params.set("region", region);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const url = `https://api.audnex.us/books/${asin}/chapters${qs}`;
      const response = await axios.get(url, { timeout: 10000 });
      res.json(response.data);
    } catch (error: any) {
      console.error("Failed to fetch chapters from Audnexus:", error.message);
      const status = error.response?.status || 500;
      const msg = status === 404
        ? "This ASIN was not found in the Audnexus database. Try a different region or verify the Audible ASIN."
        : error.message;
      res.status(status).json({ error: msg });
    }
  });

  // Always mount the proxy middleware so dynamic/direct connections from client can be proxied
  app.use("/api/abs", createProxyMiddleware({
    target: ABS_URL || "http://localhost:13378",
    router: (req) => {
      const xAbsUrl = req.headers['x-abs-url'];
      if (typeof xAbsUrl === 'string' && xAbsUrl) {
        return xAbsUrl.endsWith('/') ? xAbsUrl.slice(0, -1) : xAbsUrl;
      }
      return ABS_URL || undefined;
    },
    changeOrigin: true,
    pathRewrite: {
      '^/': '/api/'
    },
    on: {
      proxyReq: (proxyReq, req) => {
        // Inject env-level extra headers first, then client-supplied ones
        const clientExtra = parseClientExtraHeaders(req);
        const merged = { ...envExtraHeaders, ...clientExtra };
        for (const [key, value] of Object.entries(merged)) {
          proxyReq.setHeader(key, value);
        }
        // Remove the forwarding envelope header — don't leak it to ABS
        proxyReq.removeHeader('x-abs-extra-headers');
        // If client sends Authorization header, keep it. Otherwise, use ABS_TOKEN if configured.
        const clientAuth = req.headers['authorization'];
        if (!clientAuth && ABS_TOKEN) {
          proxyReq.setHeader('Authorization', `Bearer ${ABS_TOKEN}`);
        }
      },
      error: (err, req, res: any) => {
        console.error("Proxy error:", err.message);
        const errorMsg = formatError(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMsg }));
      }
    }
  }));

  // Proxy metadata requests for covers/images
  app.use("/metadata", createProxyMiddleware({
    target: ABS_URL || "http://localhost:13378",
    router: (req) => {
      const parsedUrl = new URL(req.url || "", "http://localhost");
      const queryAbsUrl = parsedUrl.searchParams.get("absUrl");
      if (queryAbsUrl) {
        return queryAbsUrl.endsWith('/') ? queryAbsUrl.slice(0, -1) : queryAbsUrl;
      }
      return ABS_URL || undefined;
    },
    changeOrigin: true,
    pathRewrite: {
      '^/items/(.*)/cover.jpg': '/api/items/$1/cover'
    },
    on: {
      proxyReq: (proxyReq, req) => {
        // Inject extra headers for metadata/image requests too
        const clientExtra = parseClientExtraHeaders(req);
        const merged = { ...envExtraHeaders, ...clientExtra };
        for (const [key, value] of Object.entries(merged)) {
          proxyReq.setHeader(key, value);
        }
        proxyReq.removeHeader('x-abs-extra-headers');
        const clientAuth = req.headers['authorization'];
        if (clientAuth) {
          proxyReq.setHeader('Authorization', typeof clientAuth === 'string' ? clientAuth : '');
        } else {
          const parsedUrl = new URL(req.url || "", "http://localhost");
          const queryToken = parsedUrl.searchParams.get("token");
          if (queryToken) {
            proxyReq.setHeader('Authorization', `Bearer ${queryToken}`);
          } else if (ABS_TOKEN) {
            proxyReq.setHeader('Authorization', `Bearer ${ABS_TOKEN}`);
          }
        }
      },
      error: (err, req, res: any) => {
        console.error("Metadata proxy error:", err.message);
        const errorMsg = formatError(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMsg }));
      }
    }
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
