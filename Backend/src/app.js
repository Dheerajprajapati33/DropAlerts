import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import pairRoutes from "./routes/pairRoutes.js";
import fallRoutes from "./routes/fallRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import nearbyRoutes from "./routes/nearbyRoutes.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN === "*" || !process.env.CORS_ORIGIN
        ? "*"
        : process.env.CORS_ORIGIN.split(","),
  }),
);
app.use(express.json({ limit: "32kb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly." },
});

const apiRouter = express.Router();
apiRouter.use(apiLimiter);
apiRouter.get("/health", (req, res) =>
  res.json({ success: true, message: "FallAlert API running" }),
);

apiRouter.use("/auth/login", strictLimiter);
apiRouter.use("/auth/register", strictLimiter);
apiRouter.use("/auth/forgot-password", strictLimiter);
apiRouter.use("/devices/pair", strictLimiter);
apiRouter.use("/nearby/broadcast", strictLimiter);

apiRouter.use("/auth", authRoutes);
apiRouter.use("/devices", deviceRoutes);
apiRouter.use("/pairings", pairRoutes);
apiRouter.use("/falls", fallRoutes);
apiRouter.use("/alerts", alertRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use("/nearby", nearbyRoutes);

// Mount under both /api/v1 (documented) and /api (Frontend default baseURL)
app.use("/api/v1", apiRouter);
app.use("/api", apiRouter);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, req, res, next) => {
  if (err.code === 11000)
    return res.status(409).json({ error: "Duplicate record" });
  if (err.name === "CastError")
    return res.status(400).json({ error: "Invalid ID" });
  if (process.env.NODE_ENV !== "test") console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Internal server error" });
});

export default app;
