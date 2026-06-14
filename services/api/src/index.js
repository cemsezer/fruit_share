import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";

import healthRoutes from "./routes/health.js";
import listingsRoutes from "./routes/listings.js";
import moderationRoutes from "./routes/moderation.js";
import requestsRoutes from "./routes/requests.js";

const app = express();
const port = process.env.PORT || 4000;
const clientOrigins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: clientOrigins.includes("*") ? true : clientOrigins
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.use(healthRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/moderation", moderationRoutes);

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  return res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Fruit Share API listening on http://localhost:${port}`);
});
