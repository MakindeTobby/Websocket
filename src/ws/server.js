import { WebSocket, WebSocketServer } from "ws";
import { httpArcjet, wsArcjet } from "../arcjet.js";

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
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", async (ws, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;

          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Access denied";

          ws.close(code, reason);
          return;
        }
      } catch (e) {
        console.error("WS security error:", e);
        ws.close(1011, "Security error");
        return;
      }
    }

    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    sendJson(ws, { type: "welcome" });

    ws.on("error", console.error);
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      // if it's not open, skip (or terminate)
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
  }, 30_000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
