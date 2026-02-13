import express from "express";
import { config } from "dotenv";
const app = express();
config();
const port = process.env.PORT || 8080;
app.use(express.json());

app.get("/", (req, res) => {
  res.send("hello from simple server :)");
});

app.listen(port, () =>
  console.log("> Server is up and running on port : " + port),
);
