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
  function getAbsApi() {
    return axios.create({
      baseURL: ABS_URL,
      headers: {
        'Authorization': `Bearer ${ABS_TOKEN}`
      }
    });
  }

  // Custom proxy route for health check (ping)
  app.get("/api/abs/health", async (req, res) => {
    try {
      const api = getAbsApi();
      const response = await api.get("ping");
      res.json(response.data);
    } catch (error: any) {
      console.error("Health check failed:", error.message);
      res.json({ error: error.message, status: error.response?.status });
    }
  });

  // Custom proxy route for recent items (fetches from all libraries)
  app.get("/api/abs/recent", async (req, res) => {
    try {
      const api = getAbsApi();
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
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // In-memory cache for sessions standard query
  let sessionsCache: { data: any; timestamp: number } | null = null;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  app.get("/api/abs/sessions", async (req, res) => {
    try {
      const { itemsPerPage, sort, desc, bypassCache } = req.query;
      const isStandardQuery = itemsPerPage === "500" && sort === "startedAt" && desc === "1";
      const shouldBypass = bypassCache === "true";

      if (isStandardQuery && !shouldBypass && sessionsCache && (Date.now() - sessionsCache.timestamp < CACHE_TTL)) {
        return res.json(sessionsCache.data);
      }

      const api = getAbsApi();
      const response = await api.get("api/sessions", { params: req.query });

      if (isStandardQuery) {
        sessionsCache = {
          data: response.data,
          timestamp: Date.now()
        };
      }

      res.json(response.data);
    } catch (error: any) {
      console.error("Failed to fetch sessions:", error.message);
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  if (ABS_URL && ABS_TOKEN) {
    // Proxy remaining API requests directly
    app.use("/api/abs", createProxyMiddleware({
      target: ABS_URL,
      changeOrigin: true,
      pathRewrite: {
        '^/': '/api/'
      },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${ABS_TOKEN}`);
        }
      }
    }));

    // Proxy metadata requests for covers/images
    app.use("/metadata", createProxyMiddleware({
      target: ABS_URL,
      changeOrigin: true,
      pathRewrite: {
        '^/items/(.*)/cover.jpg': '/api/items/$1/cover'
      },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${ABS_TOKEN}`);
        }
      }
    }));
  }

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
