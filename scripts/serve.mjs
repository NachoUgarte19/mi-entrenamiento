import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out"),
  port = Number(process.env.PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let name = decodeURIComponent(url.pathname);
      if (name.endsWith("/")) name += "index.html";
      const file = path.resolve(root, "." + name);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const buffer = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control":
          name.endsWith("sw.js") || name.endsWith(".html")
            ? "no-cache"
            : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(buffer);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Mi entrenamiento: http://localhost:${port}`),
  );
