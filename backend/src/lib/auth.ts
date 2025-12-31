import { Request, Response, NextFunction } from "express";

// Middleware to verify session token from frontend
export async function verifySession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionToken = req.headers.authorization?.replace("Bearer ", "");
  
  if (!sessionToken) {
    return res.status(401).json({ error: "Unauthorized - No session token" });
  }

  try {
    // Decode the session token (it's a JWT from NextAuth)
    const [, payload] = sessionToken.split(".");
    if (!payload) {
      return res.status(401).json({ error: "Invalid session token" });
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    
    if (!decoded.robloxId) {
      return res.status(401).json({ error: "Invalid session - no robloxId" });
    }

    // Attach user info to request
    req.user = {
      robloxId: decoded.robloxId,
      name: decoded.name,
    };

    next();
  } catch (error) {
    console.error("Session verification error:", error);
    return res.status(401).json({ error: "Invalid session token" });
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        robloxId: string;
        name?: string;
      };
    }
  }
}
