/**
 * KARE COİN & TKM OYUNU
 * Kare (KR): Fotoğrafçılık temalı sanal para birimi
 * TKM: 📷 Kamera(Taş) vs 🎞️Film(Kağıt) vs ✂️Makas
 */

import * as kv from "./kv_store.tsx";
import { getCompanyId } from "./company_kv.tsx";

const KARE_STARTING_BONUS = 500;
const KARE_DAILY_BONUS    = 100;
const KARE_DAILY_MS       = 24 * 60 * 60 * 1000;

// Kamera > Makas, Film > Kamera, Makas > Film
function tkmWinner(a: string, b: string): "a" | "b" | "draw" {
  if (a === b) return "draw";
  if (
    (a === "kamera" && b === "makas") ||
    (a === "film"   && b === "kamera") ||
    (a === "makas"  && b === "film")
  ) return "a";
  return "b";
}

function tkmCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

async function retryOp<T>(op: () => Promise<T>, maxAttempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await op(); } catch (err) {
      lastErr = err;
      const msg = String(err);
      const isTransient = msg.includes("connection reset") || msg.includes("Connection reset") || msg.includes("broken pipe");
      if (!isTransient || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

async function kareGetWallet(userId: string): Promise<any> {
  return (await kv.get(`kare_wallet_${userId}`)) || null;
}

async function kareUpdateBalance(userId: string, delta: number, userName: string, companyId: string): Promise<number> {
  const w: any = (await kareGetWallet(userId)) || { balance: 0, createdAt: Date.now() };
  const newBalance = Math.max(0, (w.balance || 0) + delta);
  const updated = { ...w, userId, userName, companyId, balance: newBalance };
  await kv.set(`kare_wallet_${userId}`, updated);
  await kv.set(`kare_cuser_${companyId}_${userId}`, { userId, userName, companyId, balance: newBalance });
  return newBalance;
}

async function kareTx(userId: string, type: string, amount: number, delta: number, counterpart: string, note: string) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  await kv.set(`kare_tx_${userId}_${ts}_${rand}`, {
    userId, type, amount, delta, counterpart, note,
    createdAt: new Date().toISOString(),
  });
}

export function registerKareTkmRoutes(app: any, verifyToken: (c: any) => Promise<any>) {

  // ── WALLET ──────────────────────────────────────────────────────────────────

  // GET /kare/wallet/me
  app.get("/make-server-4da0b637/kare/wallet/me", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const companyId = getCompanyId(user);
      const userName: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Anonim";
      let wallet: any = await kareGetWallet(user.id);
      if (!wallet) {
        wallet = { userId: user.id, userName, companyId, balance: 0, lastDailyBonus: null, createdAt: Date.now() };
        await kv.set(`kare_wallet_${user.id}`, wallet);
        await kv.set(`kare_cuser_${companyId}_${user.id}`, { userId: user.id, userName, companyId, balance: 0 });
      }
      const now = Date.now();
      const canClaim = !wallet.lastDailyBonus || (now - wallet.lastDailyBonus) >= KARE_DAILY_MS;
      const nextClaimMs = wallet.lastDailyBonus ? Math.max(0, KARE_DAILY_MS - (now - wallet.lastDailyBonus)) : 0;
      return c.json({ ok: true, wallet: { ...wallet, canClaim, nextClaimMs } });
    } catch (e) {
      console.log("[Kare] wallet/me error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // POST /kare/wallet/claim
  app.post("/make-server-4da0b637/kare/wallet/claim", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const companyId = getCompanyId(user);
      const userName: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Anonim";
      let wallet: any = await kareGetWallet(user.id);
      const now = Date.now();
      const isNew = !wallet;
      if (!wallet) wallet = { balance: 0, lastDailyBonus: null, createdAt: now };
      const canClaim = !wallet.lastDailyBonus || (now - wallet.lastDailyBonus) >= KARE_DAILY_MS;
      if (!canClaim) {
        const nextMs = KARE_DAILY_MS - (now - wallet.lastDailyBonus);
        return c.json({ error: `Günlük bonus ${Math.ceil(nextMs / 60000)} dakika sonra alınabilir.`, nextClaimMs: nextMs }, 400);
      }
      const amount = isNew ? KARE_STARTING_BONUS : KARE_DAILY_BONUS;
      const newBal = (wallet.balance || 0) + amount;
      const updated = { ...wallet, userId: user.id, userName, companyId, balance: newBal, lastDailyBonus: now };
      await kv.set(`kare_wallet_${user.id}`, updated);
      await kv.set(`kare_cuser_${companyId}_${user.id}`, { userId: user.id, userName, companyId, balance: newBal });
      await kareTx(user.id, "bonus", amount, amount, "Sistem", isNew ? "Hoş geldin bonusu 🎉" : "Günlük bonus 📅");
      console.log(`[Kare] ${userName} ${amount} KR claim etti (yeni: ${isNew})`);
      return c.json({ ok: true, amount, balance: newBal, isNew });
    } catch (e) {
      console.log("[Kare] claim error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // GET /kare/wallet/company-users
  app.get("/make-server-4da0b637/kare/wallet/company-users", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const companyId = getCompanyId(user);
      const all: any[] = await retryOp(() => kv.getByPrefix(`kare_cuser_${companyId}_`)) || [];
      const users = all
        .filter((u: any) => u?.userId && u.userId !== user.id)
        .map((u: any) => ({ userId: u.userId, userName: u.userName, balance: u.balance || 0 }))
        .sort((a: any, b: any) => b.balance - a.balance);
      return c.json({ ok: true, users });
    } catch (e) {
      console.log("[Kare] company-users error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // POST /kare/wallet/send
  app.post("/make-server-4da0b637/kare/wallet/send", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const body = await c.req.json();
      const toUserId: string = body.toUserId;
      const amount: number   = Math.floor(Number(body.amount) || 0);
      const note: string     = (body.note || "").slice(0, 80);
      const senderName: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Anonim";
      const companyId = getCompanyId(user);

      if (!toUserId || toUserId === user.id) return c.json({ error: "Geçersiz alıcı" }, 400);
      if (amount < 1) return c.json({ error: "Minimum 1 KR gönderebilirsiniz" }, 400);
      if (amount > 10000) return c.json({ error: "Tek seferde max 10.000 KR" }, 400);

      const senderWallet: any = await kareGetWallet(user.id);
      if (!senderWallet || (senderWallet.balance || 0) < amount) {
        return c.json({ error: "Yetersiz Kare bakiyesi" }, 400);
      }
      const recipientWallet: any = await kareGetWallet(toUserId);
      if (!recipientWallet) return c.json({ error: "Alıcının cüzdanı bulunamadı" }, 404);
      if (recipientWallet.companyId !== companyId) return c.json({ error: "Sadece aynı şirkete para gönderebilirsiniz" }, 403);

      const recipientName = recipientWallet.userName || "Kullanıcı";
      const senderBal = await kareUpdateBalance(user.id, -amount, senderName, companyId);
      await kareUpdateBalance(toUserId, amount, recipientName, recipientWallet.companyId);
      await kareTx(user.id,  "send",    amount,  -amount, recipientName, note || `${recipientName}'a gönderildi`);
      await kareTx(toUserId, "receive", amount,   amount, senderName,    note || `${senderName}'dan alındı`);
      console.log(`[Kare] ${senderName} → ${recipientName}: ${amount} KR`);
      return c.json({ ok: true, senderBalance: senderBal, amount, to: recipientName });
    } catch (e) {
      console.log("[Kare] send error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // GET /kare/wallet/history
  app.get("/make-server-4da0b637/kare/wallet/history", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const txs: any[] = await retryOp(() => kv.getByPrefix(`kare_tx_${user.id}_`)) || [];
      const sorted = txs
        .filter((t: any) => t?.createdAt)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 30);
      return c.json({ ok: true, history: sorted });
    } catch (e) {
      console.log("[Kare] history error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // GET /kare/richlist
  app.get("/make-server-4da0b637/kare/richlist", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const myCompanyId = getCompanyId(user);
      const allWallets: any[] = await retryOp(() => kv.getByPrefix("kare_wallet_")) || [];
      const list = allWallets
        .filter((w: any) => w?.userId && (w.balance || 0) >= 0)
        .sort((a: any, b: any) => (b.balance || 0) - (a.balance || 0))
        .slice(0, 50)
        .map((w: any) => ({
          userId: w.userId,
          displayName: w.companyId === myCompanyId ? w.userName : "Gizemli Meslektaş",
          isSameCompany: w.companyId === myCompanyId,
          balance: w.balance || 0,
        }));
      return c.json({ ok: true, richlist: list });
    } catch (e) {
      console.log("[Kare] richlist error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // ── TKM OYUNU ───────────────────────────────────────────────────────────────

  // POST /tkm/solo
  app.post("/make-server-4da0b637/tkm/solo", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const body = await c.req.json();
      const choice: string = body.choice;
      const bet: number    = Math.floor(Number(body.bet) || 0);
      const userName: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Anonim";
      const companyId = getCompanyId(user);

      if (!["kamera", "film", "makas"].includes(choice)) return c.json({ error: "Geçersiz seçim" }, 400);
      // bet=0 → bahissiz (bilgisayara karşı mod), sadece istatistik

      const choices = ["kamera", "film", "makas"];
      const computerChoice = choices[Math.floor(Math.random() * 3)];
      const result = tkmWinner(choice, computerChoice);
      let resultLabel = result === "a" ? "win" : result === "b" ? "lose" : "draw";

      // İstatistik güncelle (bahissiz)
      const stats: any = (await kv.get(`tkm_stats_${user.id}`)) || { wins: 0, losses: 0, draws: 0, totalEarned: 0 };
      if (result === "a") stats.wins++;
      else if (result === "b") stats.losses++;
      else stats.draws++;
      stats.userId = user.id; stats.userName = userName; stats.companyId = companyId;
      await kv.set(`tkm_stats_${user.id}`, stats);

      const wallet: any = await kareGetWallet(user.id);
      return c.json({ ok: true, playerChoice: choice, computerChoice, result: resultLabel, delta: 0, newBalance: wallet?.balance || 0 });
    } catch (e) {
      console.log("[TKM] solo error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // POST /tkm/room/create
  app.post("/make-server-4da0b637/tkm/room/create", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const body = await c.req.json();
      const bet: number = Math.floor(Number(body.bet) || 50);
      const userName: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Anonim";
      const companyId = getCompanyId(user);

      if (bet < 1) return c.json({ error: "Minimum bahis 1 KR" }, 400);
      const wallet: any = await kareGetWallet(user.id);
      if (!wallet || (wallet.balance || 0) < bet) return c.json({ error: "Yetersiz Kare bakiyesi" }, 400);

      let code = tkmCode();
      let ex = await retryOp(() => kv.get(`tkm_room_${code}`));
      let att = 0;
      while (ex && att < 10) { code = tkmCode(); ex = await retryOp(() => kv.get(`tkm_room_${code}`)); att++; }

      const now = Date.now();
      const room = {
        code, bet,
        hostId: user.id, hostName: userName, hostCompanyId: companyId, hostChoice: null,
        guestId: null, guestName: null, guestCompanyId: null, guestChoice: null,
        status: "waiting", winner: null, pot: 0,
        createdAt: now, lastActivity: now,
      };
      await retryOp(() => kv.set(`tkm_room_${code}`, room));
      await retryOp(() => kv.set(`tkm_open_${code}`, { code, bet, hostName: userName, createdAt: now }));
      console.log(`[TKM] Oda: ${code} bahis=${bet} KR`);
      return c.json({ ok: true, room });
    } catch (e) {
      console.log("[TKM] create error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // GET /tkm/rooms/open
  app.get("/make-server-4da0b637/tkm/rooms/open", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const markers: any[] = await retryOp(() => kv.getByPrefix("tkm_open_")) || [];
      const now = Date.now();
      const rooms: any[] = [];
      for (const m of markers) {
        if (!m?.code) continue;
        if (now - (m.createdAt || 0) > 10 * 60 * 1000) { await kv.del(`tkm_open_${m.code}`).catch(() => {}); continue; }
        const r: any = await retryOp(() => kv.get(`tkm_room_${m.code}`));
        if (!r || r.status !== "waiting" || r.hostId === user.id) continue;
        rooms.push({ code: r.code, bet: r.bet, hostName: r.hostName, hostCompanyId: r.hostCompanyId, createdAt: r.createdAt });
      }
      return c.json({ ok: true, rooms });
    } catch (e) {
      console.log("[TKM] rooms/open error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // POST /tkm/room/join
  app.post("/make-server-4da0b637/tkm/room/join", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const body = await c.req.json();
      const code: string = (body.code || "").toUpperCase().trim();
      const userName: string = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Anonim";
      const companyId = getCompanyId(user);

      if (!code) return c.json({ error: "Oda kodu gerekli" }, 400);
      const room: any = await retryOp(() => kv.get(`tkm_room_${code}`));
      if (!room) return c.json({ error: "Oda bulunamadı" }, 404);
      if (room.status !== "waiting") return c.json({ error: "Oda dolu veya sona erdi" }, 400);
      if (room.hostId === user.id) return c.json({ error: "Kendi odanıza katılamazsınız" }, 400);

      const guestWallet: any = await kareGetWallet(user.id);
      if (!guestWallet || (guestWallet.balance || 0) < room.bet) return c.json({ error: `Yetersiz bakiye. Gereken: ${room.bet} KR` }, 400);
      const hostWallet: any = await kareGetWallet(room.hostId);
      if (!hostWallet || (hostWallet.balance || 0) < room.bet) return c.json({ error: "Ev sahibinin bakiyesi yetersiz" }, 400);

      await kareUpdateBalance(user.id,     -room.bet, userName,       companyId);
      await kareUpdateBalance(room.hostId, -room.bet, room.hostName,  room.hostCompanyId);

      const updated = {
        ...room,
        guestId: user.id, guestName: userName, guestCompanyId: companyId,
        status: "choosing", pot: room.bet * 2, lastActivity: Date.now(),
      };
      await retryOp(() => kv.set(`tkm_room_${code}`, updated));
      await kv.del(`tkm_open_${code}`).catch(() => {});
      return c.json({ ok: true, room: updated });
    } catch (e) {
      console.log("[TKM] join error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // GET /tkm/room/:code
  app.get("/make-server-4da0b637/tkm/room/:code", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const code = c.req.param("code").toUpperCase();
      const room: any = await retryOp(() => kv.get(`tkm_room_${code}`));
      if (!room) return c.json({ error: "Oda bulunamadı" }, 404);

      const now = Date.now();
      if (room.status === "choosing" && now - room.lastActivity > 5 * 60 * 1000) {
        if (room.pot > 0) {
          const half = room.pot / 2;
          await kareUpdateBalance(room.hostId,  half, room.hostName,  room.hostCompanyId);
          await kareUpdateBalance(room.guestId, half, room.guestName, room.guestCompanyId);
        }
        const expired = { ...room, status: "finished", winner: "timeout" };
        await retryOp(() => kv.set(`tkm_room_${code}`, expired));
        return c.json({ ok: true, room: expired });
      }

      const isHost = room.hostId === user.id;
      const safeRoom = { ...room };
      if (room.status !== "finished") {
        if (isHost) safeRoom.guestChoice = room.guestChoice ? "?" : null;
        else        safeRoom.hostChoice  = room.hostChoice  ? "?" : null;
      }
      return c.json({ ok: true, room: safeRoom });
    } catch (e) {
      console.log("[TKM] get room error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // POST /tkm/room/:code/choose
  app.post("/make-server-4da0b637/tkm/room/:code/choose", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const code = c.req.param("code").toUpperCase();
      const body = await c.req.json();
      const choice: string = body.choice;
      if (!["kamera", "film", "makas"].includes(choice)) return c.json({ error: "Geçersiz seçim" }, 400);

      const room: any = await retryOp(() => kv.get(`tkm_room_${code}`));
      if (!room) return c.json({ error: "Oda bulunamadı" }, 404);
      if (room.status !== "choosing") return c.json({ error: "Oyun seçim aşamasında değil" }, 400);

      const isHost  = room.hostId  === user.id;
      const isGuest = room.guestId === user.id;
      if (!isHost && !isGuest) return c.json({ error: "Bu odada değilsiniz" }, 403);
      if (isHost  && room.hostChoice)  return c.json({ error: "Zaten seçtiniz" }, 400);
      if (isGuest && room.guestChoice) return c.json({ error: "Zaten seçtiniz" }, 400);

      const updated: any = { ...room, lastActivity: Date.now() };
      if (isHost) updated.hostChoice = choice;
      else        updated.guestChoice = choice;

      if (updated.hostChoice && updated.guestChoice) {
        const r = tkmWinner(updated.hostChoice, updated.guestChoice);
        updated.status = "finished";

        if (r === "draw") {
          updated.winner = "draw";
          const half = updated.pot / 2;
          await kareUpdateBalance(room.hostId,  half, room.hostName,  room.hostCompanyId);
          await kareUpdateBalance(room.guestId, half, room.guestName, room.guestCompanyId);
          await kareTx(room.hostId,  "tkm_draw", half, 0, room.guestName, `TKM Beraberlik (${updated.hostChoice} vs ${updated.guestChoice})`);
          await kareTx(room.guestId, "tkm_draw", half, 0, room.hostName,  `TKM Beraberlik (${updated.guestChoice} vs ${updated.hostChoice})`);
        } else {
          const winnerId    = r === "a" ? room.hostId   : room.guestId;
          const winnerName  = r === "a" ? room.hostName  : room.guestName;
          const winnerCo    = r === "a" ? room.hostCompanyId : room.guestCompanyId;
          const loserId     = r === "a" ? room.guestId   : room.hostId;
          const loserName   = r === "a" ? room.guestName  : room.hostName;
          const loserCo     = r === "a" ? room.guestCompanyId : room.hostCompanyId;
          const winChoice   = r === "a" ? updated.hostChoice  : updated.guestChoice;
          const loseChoice  = r === "a" ? updated.guestChoice : updated.hostChoice;
          updated.winner    = r === "a" ? "host" : "guest";

          await kareUpdateBalance(winnerId, updated.pot, winnerName, winnerCo);
          await kareTx(winnerId, "tkm_win",  updated.pot,     updated.pot,    loserName,  `TKM Kazandı! (${winChoice} > ${loseChoice})`);
          await kareTx(loserId,  "tkm_lose", updated.pot / 2, -updated.pot/2, winnerName, `TKM Kaybetti (${loseChoice} < ${winChoice})`);

          for (const [uid, uname, uco, isWin] of [
            [winnerId, winnerName, winnerCo, true],
            [loserId,  loserName,  loserCo,  false],
          ] as [string, string, string, boolean][]) {
            const st: any = (await kv.get(`tkm_stats_${uid}`)) || { wins: 0, losses: 0, draws: 0, totalEarned: 0 };
            if (isWin) { st.wins++;    st.totalEarned = (st.totalEarned || 0) + updated.pot / 2; }
            else       { st.losses++;  st.totalEarned = (st.totalEarned || 0) - updated.pot / 2; }
            await kv.set(`tkm_stats_${uid}`, { ...st, userId: uid, userName: uname, companyId: uco });
          }
        }
      }

      await retryOp(() => kv.set(`tkm_room_${code}`, updated));

      const safeRoom = { ...updated };
      if (updated.status !== "finished") {
        if (isHost) safeRoom.guestChoice = updated.guestChoice ? "?" : null;
        else        safeRoom.hostChoice  = updated.hostChoice  ? "?" : null;
      }
      return c.json({ ok: true, room: safeRoom, chosen: true });
    } catch (e) {
      console.log("[TKM] choose error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // POST /tkm/room/:code/leave
  app.post("/make-server-4da0b637/tkm/room/:code/leave", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const code = c.req.param("code").toUpperCase();
      const room: any = await retryOp(() => kv.get(`tkm_room_${code}`));
      if (!room) return c.json({ ok: true });
      if (room.status === "choosing" && room.pot > 0) {
        const half = room.pot / 2;
        if (room.hostId)  await kareUpdateBalance(room.hostId,  half, room.hostName,  room.hostCompanyId);
        if (room.guestId) await kareUpdateBalance(room.guestId, half, room.guestName, room.guestCompanyId);
      }
      await kv.del(`tkm_room_${code}`).catch(() => {});
      await kv.del(`tkm_open_${code}`).catch(() => {});
      return c.json({ ok: true });
    } catch (e) {
      console.log("[TKM] leave error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });

  // GET /tkm/leaderboard
  app.get("/make-server-4da0b637/tkm/leaderboard", async (c: any) => {
    const user = await verifyToken(c);
    if (!user) return c.json({ error: "Yetkisiz" }, 401);
    try {
      const myCompanyId = getCompanyId(user);
      const stats: any[] = await retryOp(() => kv.getByPrefix("tkm_stats_")) || [];
      const list = stats
        .filter((s: any) => s?.userId && (s.wins + s.losses + s.draws) > 0)
        .sort((a: any, b: any) => (b.wins || 0) - (a.wins || 0))
        .slice(0, 50)
        .map((s: any) => ({
          userId: s.userId,
          displayName: s.companyId === myCompanyId ? s.userName : "Gizemli Meslektaş",
          isSameCompany: s.companyId === myCompanyId,
          wins: s.wins || 0, losses: s.losses || 0, draws: s.draws || 0,
          totalEarned: s.totalEarned || 0,
        }));
      return c.json({ ok: true, leaderboard: list });
    } catch (e) {
      console.log("[TKM] leaderboard error:", e);
      return c.json({ error: `${e}` }, 500);
    }
  });
}