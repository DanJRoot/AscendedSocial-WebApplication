// Content Upload Middleware
// Handles file upload validation for video and post content
import type { Request, Response, NextFunction } from "express";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

export function validateVideoUpload(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers["content-type"] || "";
  
  if (!contentType.includes("multipart/form-data") && !contentType.includes("application/json")) {
    res.status(400).json({ 
      message: "Invalid content type. Expected multipart/form-data or application/json" 
    });
    return;
  }

  next();
}

export function validateFileType(mimeType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(mimeType);
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_VIDEO_SIZE;
}
