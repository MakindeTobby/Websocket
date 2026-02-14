import express from "express";
import { config } from "dotenv";
import { matchRouter } from "./routes/matches.js";
import http from "http";
import { attachWebSockerServer } from "./ws/server.js";

config();

const portEnv = Number.parseInt(process.env.PORT ?? "8080", 10);
const PORT = Number.isFinite(portEnv) ? portEnv : 8080;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("hello from simple server :)"));
app.use("/matches", matchRouter);

const server = http.createServer(app);

const { broadcastMatchCreated } = attachWebSockerServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

// ✅ IMPORTANT: listen on the HTTP server you attached ws to
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is up and running on: ${baseUrl}`);
  console.log(
    `Websocket Server is running on: ${baseUrl.replace("http", "ws")}/ws`,
  );
});
