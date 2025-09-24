import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import next from "next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0"; // Allow external connections
const port = process.env.PORT || 3000;

async function startNextServer() {
  // Initialize Next.js app
  const app = next({ dev, hostname, port });
  const handler = app.getRequestHandler();
  await app.prepare();

  // Create HTTP server for Next.js
  const httpServer = createServer((req, res) => {
    // Handle all requests with Next.js
    return handler(req, res);
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Next.js server running on http://${hostname}:${port}`);
      console.log(`> Mode: ${dev ? "Development" : "Production"}`);
      console.log(`> Socket.IO server should be running on port 8080`);
    });
}

startNextServer().catch(console.error);

