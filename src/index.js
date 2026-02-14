import express from "express";
import { config } from "dotenv";
import { matchRouter } from "./routes/matches.js";
const app = express();
config();
const port = process.env.PORT || 8080;
app.use(express.json());

app.get("/", (req, res) => {
  res.send("hello from simple server :)");
});

app.use("/matches", matchRouter);

app.listen(port, () =>
  console.log("> Server is up and running on port : " + port),
);
