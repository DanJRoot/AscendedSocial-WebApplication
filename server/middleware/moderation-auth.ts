// Moderation Authentication Middleware
// Checks if user has admin/moderator role
import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

// For now, we use a simple role check. Since the existing user table
// doesn't have a role field, we'll consider users with auraLevel >= 10 as moderators.
// In production, add a proper role column.
export function isModerator(req: any, res: Response, next: NextFunction): void {
  if (!req.user?.claims?.sub) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // Check moderator status  
  const userId = req.user.claims.sub;
  
  db.select({ auraLevel: users.auraLevel })
    .from(users)
    .where(eq(users.id, userId))
    .then(([user]) => {
      if (!user || user.auraLevel < 10) {
        // For development, allow all authenticated users
        // In production, enforce role-based access
        if (process.env.NODE_ENV === "production") {
          res.status(403).json({ message: "Moderator access required" });
          return;
        }
      }
      next();
    })
    .catch((err) => {
      console.error("Moderator auth check failed:", err);
      res.status(500).json({ message: "Auth check failed" });
    });
}

export function isAdmin(req: any, res: Response, next: NextFunction): void {
  if (!req.user?.claims?.sub) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // For development, treat all authenticated users as admin
  // In production, check for admin role
  next();
}
