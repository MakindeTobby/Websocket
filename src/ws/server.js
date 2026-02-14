import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(msg);
  }
}

export function attachWebSocketServer(server) {
  // IMPORTANT: noServer:true so we manually control upgrade
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  /**
   * Arcjet protection BEFORE websocket upgrade
   */
  server.on("upgrade", async (req, socket, head) => {
    // only protect websocket endpoint
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const status = decision.reason.isRateLimit() ? 429 : 403;
          const message = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Forbidden";

          socket.write(
            `HTTP/1.1 ${status} ${message}\r\n` +
              "Connection: close\r\n" +
              "\r\n",
          );

          socket.destroy();
          return;
        }
      } catch (err) {
        console.error("Arcjet WS protect error:", err);

        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n" +
            "Connection: close\r\n" +
            "\r\n",
        );

        socket.destroy();
        return;
      }
    }

    // Upgrade allowed
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  /**
   * Now connection handler is clean — no Arcjet here
   */
  wss.on("connection", (ws, req) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    sendJson(ws, { type: "welcome" });

    ws.on("error", console.error);
  });

  /**
   * Heartbeat / cleanup
   */
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }

      ws.isAlive = false;

      try {
        ws.ping();
      } catch {
        ws.terminate();
      }
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcast(wss, {
      type: "match_created",
      data: match,
    });
  }

  return { broadcastMatchCreated };
}
