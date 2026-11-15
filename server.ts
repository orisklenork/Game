import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import {
  buyCustomization,
  buyWeapon,
  claimDailyMission,
  claimDailyReward,
  createAccount,
  equipCustomization,
  equipWeapon,
  getFriendsData,
  getLeaderboard,
  getMatchHistory,
  getProfileByToken,
  isUsernameAvailable,
  removeFriend,
  respondFriendRequest,
  searchPlayers,
  sendFriendRequest,
  upgradeWeapon,
} from './server/db.ts';
import { getOnlinePlayerIds, setupGameWebSocket } from './server/gameServer.ts';
import type { WeaponId } from './src/shared/gameData.ts';

function resolvePort(): number {
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && process.argv[idx + 1]) {
    const cliPort = Number(process.argv[idx + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) return cliPort;
  }
  const envPort = Number(process.env.PORT);
  // In container dev environments, nginx may set PORT=8080; keep Vite/Express dev server on 3000 unless production
  if (process.env.NODE_ENV !== 'production' && envPort === 8080) {
    return 3000;
  }
  return Number.isFinite(envPort) && envPort > 0 ? envPort : 3000;
}

const PORT = resolvePort();
const MAX_REGISTRATIONS_PER_MIN = Math.max(1, Number(process.env.RATE_LIMIT_MAX_REGISTRATIONS) || 10);

// Simple in-memory rate limiter for account creation & API protection
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Auth middleware
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const profile = getProfileByToken(token);
    if (!profile) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }
    (req as any).player = profile;
    next();
  }

  function optionalAuth(req: express.Request, _res: express.Response, next: express.NextFunction) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    (req as any).player = token ? getProfileByToken(token) : null;
    next();
  }

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Check username availability
  app.get('/api/auth/check-username', (req, res) => {
    const username = String(req.query.username || '');
    res.json(isUsernameAvailable(username));
  });

  // Username-only registration
  app.post('/api/auth/register', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`reg:${ip}`, MAX_REGISTRATIONS_PER_MIN, 60_000)) {
      res.status(429).json({ error: 'Too many account creation attempts. Please wait a minute.' });
      return;
    }
    try {
      const username = String(req.body?.username || '');
      const result = createAccount(username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Registration failed' });
    }
  });

  // Restore returning player session
  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ profile: (req as any).player });
  });

  // Weapon Shop & Upgrades
  app.post('/api/shop/weapon/buy', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const weaponId = req.body?.weaponId as WeaponId;
      const updated = buyWeapon(player.id, weaponId);
      res.json({ profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/shop/weapon/upgrade', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const weaponId = req.body?.weaponId as WeaponId;
      const updated = upgradeWeapon(player.id, weaponId);
      res.json({ profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/shop/weapon/equip', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const weaponId = req.body?.weaponId as WeaponId;
      const updated = equipWeapon(player.id, weaponId);
      res.json({ profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Character Customization
  app.post('/api/shop/customization/buy', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const itemId = String(req.body?.itemId || '');
      const updated = buyCustomization(player.id, itemId);
      res.json({ profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/shop/customization/equip', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const itemId = String(req.body?.itemId || '');
      const updated = equipCustomization(player.id, itemId);
      res.json({ profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Daily Rewards & Missions
  app.post('/api/rewards/daily', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const result = claimDailyReward(player.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/rewards/mission', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const missionType = req.body?.missionType === 'matches' ? 'matches' : 'kills';
      const result = claimDailyMission(player.id, missionType);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Friends & Search
  app.get('/api/friends', requireAuth, (req, res) => {
    const player = (req as any).player;
    res.json(getFriendsData(player.id, getOnlinePlayerIds()));
  });

  app.get('/api/players/search', requireAuth, (req, res) => {
    const player = (req as any).player;
    const q = String(req.query.q || '');
    const online = getOnlinePlayerIds();
    const results = searchPlayers(q, player.id).map((r: any) => ({
      ...r,
      is_online: online.has(r.id),
    }));
    res.json({ players: results });
  });

  app.post('/api/friends/request', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const target = String(req.body?.target || '');
      sendFriendRequest(player.id, target);
      res.json(getFriendsData(player.id, getOnlinePlayerIds()));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/friends/respond', requireAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const requestId = String(req.body?.requestId || '');
      const accept = Boolean(req.body?.accept);
      respondFriendRequest(player.id, requestId, accept);
      res.json(getFriendsData(player.id, getOnlinePlayerIds()));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/friends/:friendId', requireAuth, (req, res) => {
    const player = (req as any).player;
    removeFriend(player.id, String(req.params.friendId));
    res.json(getFriendsData(player.id, getOnlinePlayerIds()));
  });

  // Leaderboard & Match History
  app.get('/api/leaderboard', optionalAuth, (req, res) => {
    try {
      const player = (req as any).player;
      const scope = req.query.scope === 'friends' ? 'friends' : 'global';
      const sort = String(req.query.sort || 'kills');
      res.json({ entries: getLeaderboard(player?.id || null, scope, sort) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load leaderboard' });
    }
  });

  app.get('/api/matches/history', requireAuth, (req, res) => {
    const player = (req as any).player;
    res.json({ matches: getMatchHistory(player.id) });
  });

  const server = http.createServer(app);
  setupGameWebSocket(server);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Nightfall server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Nightfall server:', err);
  process.exit(1);
});
