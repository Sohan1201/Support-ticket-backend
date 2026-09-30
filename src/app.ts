import express from "express";
import ticketsRouter from "./routes/tickets.routes";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use(ticketsRouter);

export default app;