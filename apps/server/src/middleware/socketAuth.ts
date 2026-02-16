import type { Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import { verifySessionCookie, AccountDao, CharacterDao } from "@shireland/database";
import type { CharacterRow } from "@shireland/database";

export interface SocketData {
  accountId?: number;
  character?: CharacterRow;
}

const COOKIE_NAME = "shireland_session";

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) {
    next(new Error("No session cookie"));
    return;
  }

  const cookies = parseCookie(cookieHeader);
  const sessionCookie = cookies[COOKIE_NAME];
  if (!sessionCookie) {
    next(new Error("No session cookie"));
    return;
  }

  const session = verifySessionCookie(sessionCookie);
  if (!session) {
    next(new Error("Invalid session"));
    return;
  }

  const account = await AccountDao.findById(session.id);
  if (!account) {
    next(new Error("Account not found"));
    return;
  }

  (socket.data as SocketData).accountId = account.id;

  // Pre-load character if exists
  const character = await CharacterDao.findByAccountId(account.id);
  if (character) {
    (socket.data as SocketData).character = character;
  }

  next();
}
