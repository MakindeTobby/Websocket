import { WebSocket, WebSocketServer } from "ws";

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

  wss.on("connection", (ws) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    sendJson(ws, { type: "welcome" });

    ws.on("error", (err) => {
      console.error("WS error:", err);
    });
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
