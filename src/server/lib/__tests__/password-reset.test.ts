import { describe, expect, it } from "vitest";
import { makeDb, seedUser } from "@/server/providers/__tests__/helpers";
import {
  RESET_TICKET_SUBJECT,
  RESET_TTL_MS,
  canSelfReset,
  consumeResetToken,
  createResetTicketOnce,
  createResetToken,
  findUserByIdentifier,
  hashResetToken,
  isResetTokenValid,
} from "../password-reset";

const t0 = new Date("2026-11-25T10:00:00.000Z");
const later = (ms: number) => new Date(t0.getTime() + ms);

function setup() {
  const db = makeDb();
  const u = seedUser(db, { n: 1 });
  db.prepare("UPDATE User SET phone = '+919876543210' WHERE id = ?").run(u.userId);
  return { db, userId: u.userId };
}

describe("password reset tokens", () => {
  it("stores only a hash, never the raw token", () => {
    const { db, userId } = setup();
    const token = createResetToken(db, userId, t0);
    const rows = db.prepare("SELECT tokenHash FROM PasswordResetToken").all() as { tokenHash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashResetToken(token));
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it("sets the new password, marks the token used and revokes every session", () => {
    const { db, userId } = setup();
    db.prepare("INSERT INTO Session (id, userId, refreshToken, expiresAt) VALUES ('s1', ?, 'r1', ?)").run(userId, later(1e9).toISOString());
    db.prepare("INSERT INTO Session (id, userId, refreshToken, expiresAt) VALUES ('s2', ?, 'r2', ?)").run(userId, later(1e9).toISOString());
    const token = createResetToken(db, userId, t0);

    expect(consumeResetToken(db, token, "NEWHASH", later(1000))).toBe(userId);

    const user = db.prepare("SELECT passwordHash FROM User WHERE id = ?").get(userId) as { passwordHash: string };
    expect(user.passwordHash).toBe("NEWHASH");
    const open = db.prepare("SELECT COUNT(*) AS n FROM Session WHERE userId = ? AND revokedAt IS NULL").get(userId) as { n: number };
    expect(open.n).toBe(0);
  });

  it("works only once", () => {
    const { db, userId } = setup();
    const token = createResetToken(db, userId, t0);
    expect(consumeResetToken(db, token, "H1", later(1000))).toBe(userId);
    expect(consumeResetToken(db, token, "H2", later(2000))).toBeNull();
    const user = db.prepare("SELECT passwordHash FROM User WHERE id = ?").get(userId) as { passwordHash: string };
    expect(user.passwordHash).toBe("H1");
  });

  it("expires after the TTL", () => {
    const { db, userId } = setup();
    const token = createResetToken(db, userId, t0);
    expect(isResetTokenValid(db, token, later(RESET_TTL_MS - 1000))).toBe(true);
    expect(isResetTokenValid(db, token, later(RESET_TTL_MS + 1000))).toBe(false);
    expect(consumeResetToken(db, token, "H", later(RESET_TTL_MS + 1000))).toBeNull();
    const user = db.prepare("SELECT passwordHash FROM User WHERE id = ?").get(userId) as { passwordHash: string };
    expect(user.passwordHash).toBe("x"); // unchanged
  });

  it("a newer link invalidates the older one", () => {
    const { db, userId } = setup();
    const first = createResetToken(db, userId, t0);
    const second = createResetToken(db, userId, later(1000));
    expect(isResetTokenValid(db, first, later(2000))).toBe(false);
    expect(isResetTokenValid(db, second, later(2000))).toBe(true);
  });

  it("rejects unknown tokens without changing anything", () => {
    const { db, userId } = setup();
    createResetToken(db, userId, t0);
    expect(consumeResetToken(db, "not-a-real-token-0123456789", "H", later(1000))).toBeNull();
    const user = db.prepare("SELECT passwordHash FROM User WHERE id = ?").get(userId) as { passwordHash: string };
    expect(user.passwordHash).toBe("x");
  });
});

describe("finding the account", () => {
  it("finds by email (case-insensitive) and by phone, and returns nothing for unknown ids", () => {
    const { db, userId } = setup();
    expect(findUserByIdentifier(db, "U1@X.TEST")?.id).toBe(userId);
    expect(findUserByIdentifier(db, "9876543210")?.id).toBe(userId); // typed without +91
    expect(findUserByIdentifier(db, "+91 98765 43210")?.id).toBe(userId); // formatted
    expect(findUserByIdentifier(db, "nobody@x.test")).toBeUndefined();
  });

  it("banned accounts cannot self-reset", () => {
    const { db, userId } = setup();
    db.prepare("UPDATE User SET status = 'BANNED' WHERE id = ?").run(userId);
    expect(canSelfReset(findUserByIdentifier(db, "u1@x.test")!)).toBe(false);
  });
});

describe("support-ticket fallback", () => {
  it("creates one ticket per user per 24h, then again after a day", () => {
    const { db, userId } = setup();
    const user = findUserByIdentifier(db, "u1@x.test")!;
    expect(createResetTicketOnce(db, user, "u1@x.test", t0)).toBe(true);
    expect(createResetTicketOnce(db, user, "u1@x.test", later(60_000))).toBe(false);
    expect(createResetTicketOnce(db, user, "u1@x.test", later(25 * 60 * 60_000))).toBe(true);
    const n = db.prepare("SELECT COUNT(*) AS n FROM SupportTicket WHERE userId = ? AND subject = ?").get(userId, RESET_TICKET_SUBJECT) as { n: number };
    expect(n.n).toBe(2);
  });
});
