import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import compression from "compression";
import next from "next";
import { Server, type Socket } from "socket.io";
import { authenticateSocket } from "@/lib/socket-auth";
import { registerSocketHandlers } from "@/lib/socket-handlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const compress = compression({ level: 6 }) as (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    compress(req, res, () => handle(req, res));
  });

  const io = new Server(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const user = (socket as Socket & { user?: { id: string } }).user;
    console.log(`Socket connected: ${user?.id}`);
    registerSocketHandlers(io, socket);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
