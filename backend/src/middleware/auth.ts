import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'miniledger_super_secret_jwt_key_2026_receipts';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  name: string;
  phone?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required to access this resource.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;

    // Verify user exists in database (guards against stale client tokens after DB seeds or test runs)
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, phone: true },
    });

    if (!dbUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User session has expired. Please log in again.',
      });
      return;
    }

    req.user = dbUser;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token.',
    });
    return;
  }
};
