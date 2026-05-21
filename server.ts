import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  let ABS_URL = process.env.ABS_URL || "";
  if (ABS_URL.endsWith('/')) {
    ABS_URL = ABS_URL.slice(0, -1);
  }
  const ABS_TOKEN = process.env.ABS_TOKEN;

  if (!ABS_URL || !ABS_TOKEN) {
    console.error("WARNING: Audiobookshelf URL and Token are not configured.");
  }

  // Helper function for the few routes we need to intercept
  function getAbsApi(req: express.Request) {
    const xAbsUrl = req.headers['x-abs-url'] || ABS_URL;
    const clientAuth = req.headers['authorization'];
    
    const targetUrl = typeof xAbsUrl === 'string' && xAbsUrl.endsWith('/') ? xAbsUrl.slice(0, -1) : xAbsUrl;
    
    const headers: Record<string, string> = {};
    if (clientAuth) {
      headers['Authorization'] = typeof clientAuth === 'string' ? clientAuth : '';
    } else if (ABS_TOKEN) {
      headers['Authorization'] = `Bearer ${ABS_TOKEN}`;
    }

    return axios.create({
      baseURL: targetUrl as string,
      headers
    });
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

  // In-memory cache for sessions standard query, keyed by target URL
  let sessionsCache: Record<string, { data: any; timestamp: number }> = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  app.get("/api/abs/sessions", async (req, res) => {
    try {
      const { itemsPerPage, sort, desc, bypassCache } = req.query;
      const isStandardQuery = itemsPerPage === "500" && sort === "startedAt" && desc === "1";
      const shouldBypass = bypassCache === "true";

      const xAbsUrl = req.headers['x-abs-url'] || ABS_URL;
      const cacheKey = typeof xAbsUrl === 'string' ? xAbsUrl : 'default';
      const cached = sessionsCache[cacheKey];

      if (isStandardQuery && !shouldBypass && cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return res.json(cached.data);
      }

      const api = getAbsApi(req);
      const response = await api.get("api/sessions", { params: req.query });

      if (isStandardQuery) {
        sessionsCache[cacheKey] = {
          data: response.data,
          timestamp: Date.now()
        };
      }

      res.json(response.data);
    } catch (error: any) {
      console.error("Failed to fetch sessions:", error.message);
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
