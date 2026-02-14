import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();
function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}
function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;
  subscribers.delete(socket);
  if (subscribers.size === 0) matchSubscribers.delete(matchId);
}
function cleanUpSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;
  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
function broadcastToALL(wss, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(msg);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function handleMessage(socket, data) {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
  }
  if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribe(message.matchId, socket);
    socket.subscriptions.add(message.matchId);
    sendJson(socket, { type: "subscribed", matchId: message.matchId });
    return;
  }
  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unsubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
    sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
    return;
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
    ws.subscriptions = new Set();

    sendJson(ws, { type: "welcome" });
    ws.on("message", (data) => handleMessage(ws, data));

    ws.on("error", () => {
      ws.terminate();
    });
    ws.on("close", () => cleanUpSubscriptions(ws));

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
    broadcastToALL(wss, {
      type: "match_created",
      data: match,
    });
  }
  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
