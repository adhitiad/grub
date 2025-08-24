import { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";

// Menambahkan properti 'user' ke interface Request Express
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

// Validate JWT_SECRET exists
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Tidak terotentikasi, token tidak valid.",
          timestamp: new Date().toISOString(),
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        role: string;
      };

      req.user = decoded;
      next();
    } catch (error) {
      console.error("JWT verification error:", error);
      return res.status(401).json({
        success: false,
        message: "Tidak terotentikasi, token gagal.",
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: "Tidak terotentikasi, tidak ada token.",
      timestamp: new Date().toISOString(),
    });
  }
};

// Middleware untuk otorisasi berdasarkan role
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Tidak terotentikasi. Silakan login terlebih dahulu.",
        timestamp: new Date().toISOString(),
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${
          req.user.role
        }' tidak diizinkan mengakses rute ini. Role yang diizinkan: ${roles.join(
          ", "
        )}`,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};
