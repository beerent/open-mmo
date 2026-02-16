import type { Request, Response, NextFunction } from "express";
import { verifySessionCookie, AccountDao } from "@shireland/database";

declare global {
  namespace Express {
    interface Request {
      accountId?: number;
      account?: { id: number; username: string; is_guest: boolean };
    }
  }
}

const COOKIE_NAME = "shireland_session";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const session = verifySessionCookie(cookie);
  if (!session) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  const account = await AccountDao.findById(session.id);
  if (!account) {
    res.status(401).json({ error: "Account not found" });
    return;
  }

  req.accountId = account.id;
  req.account = { id: account.id, username: account.username, is_guest: account.is_guest };
  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (!cookie) {
    next();
    return;
  }

  const session = verifySessionCookie(cookie);
  if (!session) {
    next();
    return;
  }

  const account = await AccountDao.findById(session.id);
  if (account) {
    req.accountId = account.id;
    req.account = { id: account.id, username: account.username, is_guest: account.is_guest };
  }

  next();
}
