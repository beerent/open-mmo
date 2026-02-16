import express, { type Request, type Response, type Router } from "express";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import {
  AccountDao,
  TwitchAccountDao,
  CharacterDao,
  hashPassword,
  verifyPassword,
  createSessionCookie,
  encryptToken,
  getAuthorizationUrl,
  exchangeCode,
  getUser,
} from "@shireland/database";
import { requireAuth } from "../middleware/auth.js";

const router: Router = express.Router();
const COOKIE_NAME = "shireland_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// 5 req/min per IP — guest account creation
const guestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many guest accounts created. Try again in a minute." },
});

// 10 req/min per IP — login / register / claim
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Try again in a minute." },
});

function setSessionCookie(res: Response, accountId: number) {
  const cookie = createSessionCookie({ id: accountId });
  res.cookie(COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

// POST /api/auth/guest
router.post("/guest", guestLimiter, async (_req: Request, res: Response) => {
  try {
    const account = await AccountDao.createGuest();
    setSessionCookie(res, account.id);
    res.json({ id: account.id, username: account.username, isGuest: true });
  } catch (err) {
    console.error("[Auth] Guest error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/claim (guest → registered)
router.post("/claim", authLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || username.trim().length < 2) {
      res.status(400).json({ error: "Username must be at least 2 characters" });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters" });
      return;
    }

    const cleanUsername = username.trim().slice(0, 32);

    if (cleanUsername.startsWith("~")) {
      res.status(400).json({ error: "Username cannot start with ~" });
      return;
    }

    if (!req.account!.is_guest) {
      res.status(400).json({ error: "Account is not a guest" });
      return;
    }

    const existing = await AccountDao.findByUsername(cleanUsername);
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = hashPassword(password);
    const claimed = await AccountDao.claimGuest(req.accountId!, cleanUsername, passwordHash);
    if (!claimed) {
      res.status(400).json({ error: "Could not claim account" });
      return;
    }

    res.json({ id: claimed.id, username: claimed.username, isGuest: false });
  } catch (err) {
    console.error("[Auth] Claim error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || username.trim().length < 2) {
      res.status(400).json({ error: "Username must be at least 2 characters" });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters" });
      return;
    }

    const cleanUsername = username.trim().slice(0, 32);

    if (cleanUsername.startsWith("~")) {
      res.status(400).json({ error: "Username cannot start with ~" });
      return;
    }

    const existing = await AccountDao.findByUsername(cleanUsername);
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = hashPassword(password);
    const account = await AccountDao.create(cleanUsername, passwordHash);

    setSessionCookie(res, account.id);
    res.json({ id: account.id, username: account.username });
  } catch (err) {
    console.error("[Auth] Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const account = await AccountDao.findByUsername(username.trim());
    if (!account || !account.password_hash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!verifyPassword(password, account.password_hash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    setSessionCookie(res, account.id);
    res.json({ id: account.id, username: account.username });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const character = await CharacterDao.findByAccountId(req.accountId!);
    res.json({
      id: req.account!.id,
      username: req.account!.username,
      isGuest: req.account!.is_guest,
      character: character
        ? {
            id: character.id,
            name: character.name,
            playerClass: character.player_class,
            x: character.x,
            y: character.y,
          }
        : null,
    });
  } catch (err) {
    console.error("[Auth] Me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/twitch — redirect to Twitch OAuth
router.get("/twitch", (_req: Request, res: Response) => {
  try {
    const state = randomBytes(16).toString("hex");
    res.cookie("twitch_state", state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 5 * 60 * 1000, // 5 min
      path: "/",
    });
    const url = getAuthorizationUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error("[Auth] Twitch redirect error:", err);
    res.status(500).json({ error: "Twitch auth not configured" });
  }
});

// GET /api/auth/twitch/callback
router.get("/twitch/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const expectedState = req.cookies?.twitch_state;

    if (!code || !state || state !== expectedState) {
      res.status(400).json({ error: "Invalid OAuth state" });
      return;
    }

    res.clearCookie("twitch_state", { path: "/" });

    const tokens = await exchangeCode(code as string);
    const twitchUser = await getUser(tokens.access_token);

    const accessEnc = encryptToken(tokens.access_token);
    const refreshEnc = encryptToken(tokens.refresh_token);

    // Check if this Twitch account is already linked
    let twitchAccount = await TwitchAccountDao.findByTwitchId(twitchUser.id);

    if (twitchAccount) {
      // Update tokens
      await TwitchAccountDao.updateTokens(twitchUser.id, accessEnc, refreshEnc);
      setSessionCookie(res, twitchAccount.account_id);
    } else {
      // Create new account + link
      const account = await AccountDao.create(twitchUser.display_name, null);
      await TwitchAccountDao.create(
        account.id,
        twitchUser.id,
        twitchUser.login,
        accessEnc,
        refreshEnc
      );
      setSessionCookie(res, account.id);
    }

    // Redirect to game
    res.redirect("/");
  } catch (err) {
    console.error("[Auth] Twitch callback error:", err);
    res.status(500).json({ error: "Twitch authentication failed" });
  }
});

export { router as authRouter };
