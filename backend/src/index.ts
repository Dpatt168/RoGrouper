import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from parent directory's .env.local (root of rogrouper)
// When running with tsx, __dirname is in src/, so we go up 2 levels to reach rogrouper/
dotenv.config({ path: path.resolve(process.cwd(), "../.env.local") });
// Also try loading from backend's own .env if it exists
dotenv.config();
import express from "express";
import cors from "cors";

// Import routes
import groupsRouter from "./routes/groups";
import membersRouter from "./routes/members";
import automationRouter from "./routes/automation";
import adminRouter from "./routes/admin";
import accessRouter from "./routes/access";
import robloxRouter from "./routes/roblox";
import auditLogRouter from "./routes/audit-log";
import botRouter from "./routes/bot";
import awardsRouter from "./routes/awards";

// Import workers
import { startSuspensionWorker } from "./workers/suspension-worker";

// Import auth middleware
import { verifySession } from "./lib/auth";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://66.228.59.100:3000",
  credentials: true,
}));
app.use(express.json());

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Apply auth middleware to all API routes
app.use("/api", verifySession);

// Routes
app.use("/api/groups", groupsRouter);
app.use("/api/groups", membersRouter);
app.use("/api/groups", automationRouter);
app.use("/api/groups", accessRouter);
app.use("/api/groups", auditLogRouter);
app.use("/api/groups", botRouter);
app.use("/api/admin", adminRouter);
app.use("/api/roblox", robloxRouter);
app.use("/api/awards", awardsRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  
  // Start the suspension worker (checks every 60 seconds)
  startSuspensionWorker(60000);
});
