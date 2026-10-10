-- ============================================================================
-- XArena — Local runtime schema (SQLite via better-sqlite3)
-- Mirrors prisma/schema.prisma 1:1. Exists because this sandbox cannot reach
-- binaries.prisma.sh to fetch Prisma's query engine. In any normal dev
-- machine / CI environment, run `npx prisma migrate dev` against Postgres
-- using prisma/schema.prisma instead.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS User (
  id            TEXT PRIMARY KEY,
  uid           TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  passwordHash  TEXT,
  authProvider  TEXT NOT NULL DEFAULT 'EMAIL',
  firebaseUid   TEXT UNIQUE,
  username      TEXT UNIQUE NOT NULL,
  displayName   TEXT,
  avatarUrl     TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'USER',
  status        TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  referralCode  TEXT UNIQUE NOT NULL,
  referredById  TEXT,
  createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt     TEXT NOT NULL DEFAULT (datetime('now')),
  lastLoginAt   TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_email ON User(email);
CREATE INDEX IF NOT EXISTS idx_user_username ON User(username);
CREATE INDEX IF NOT EXISTS idx_user_referralCode ON User(referralCode);

CREATE TABLE IF NOT EXISTS Session (
  id           TEXT PRIMARY KEY,
  userId       TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  refreshToken TEXT UNIQUE NOT NULL,
  userAgent    TEXT,
  ipAddress    TEXT,
  expiresAt    TEXT NOT NULL,
  revokedAt    TEXT,
  createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId);

CREATE TABLE IF NOT EXISTS PushToken (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  token     TEXT UNIQUE NOT NULL,
  platform  TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS PlayerStats (
  id            TEXT PRIMARY KEY,
  userId        TEXT UNIQUE NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  matchesPlayed INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  kills         INTEGER NOT NULL DEFAULT 0,
  headshots     INTEGER NOT NULL DEFAULT 0,
  totalEarnings INTEGER NOT NULL DEFAULT 0,
  currentStreak INTEGER NOT NULL DEFAULT 0,
  bestRank      INTEGER,
  updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Game (
  id             TEXT PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  shortName      TEXT,
  iconUrl        TEXT,
  bannerUrl      TEXT,
  isActive       INTEGER NOT NULL DEFAULT 1,
  sortOrder      INTEGER NOT NULL DEFAULT 0,
  supportedModes TEXT NOT NULL,
  createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_game_slug ON Game(slug);

CREATE TABLE IF NOT EXISTS Tournament (
  id                   TEXT PRIMARY KEY,
  slug                 TEXT UNIQUE NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  bannerUrl            TEXT,
  thumbnailUrl         TEXT,
  gameId               TEXT NOT NULL REFERENCES Game(id),
  mode                 TEXT NOT NULL,
  format               TEXT NOT NULL,
  cadence              TEXT NOT NULL DEFAULT 'ONE_OFF',
  status               TEXT NOT NULL DEFAULT 'DRAFT',
  entryFee             INTEGER NOT NULL DEFAULT 0,
  prizePool            INTEGER NOT NULL,
  prizeDistribution    TEXT NOT NULL,
  maxSlots             INTEGER NOT NULL,
  slotsFilled          INTEGER NOT NULL DEFAULT 0,
  roomSize             INTEGER NOT NULL DEFAULT 1,
  map                  TEXT,
  category             TEXT,
  rules                TEXT NOT NULL,
  scoringSystem        TEXT,
  registrationStartsAt TEXT NOT NULL,
  registrationEndsAt   TEXT NOT NULL,
  matchStartsAt        TEXT NOT NULL,
  matchEndsAt          TEXT,
  roomId               TEXT,
  roomPassword         TEXT,
  roomReleasedAt       TEXT,
  adminNotes           TEXT,
  isFeatured           INTEGER NOT NULL DEFAULT 0,
  slotSelection        INTEGER NOT NULL DEFAULT 1,
  createdById          TEXT NOT NULL,
  createdAt            TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tournament_gameId ON Tournament(gameId);
CREATE INDEX IF NOT EXISTS idx_tournament_status ON Tournament(status);
CREATE INDEX IF NOT EXISTS idx_tournament_matchStartsAt ON Tournament(matchStartsAt);

CREATE TABLE IF NOT EXISTS TournamentParticipant (
  id           TEXT PRIMARY KEY,
  tournamentId TEXT NOT NULL REFERENCES Tournament(id) ON DELETE CASCADE,
  userId       TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  teamName     TEXT,
  status       TEXT NOT NULL DEFAULT 'REGISTERED',
  entryTxnId   TEXT,
  slotNumber   INTEGER,
  position     INTEGER,
  ign          TEXT,
  gameUid      TEXT,
  joinedAt     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tournamentId, userId)
);
CREATE INDEX IF NOT EXISTS idx_participant_tournamentId ON TournamentParticipant(tournamentId);
CREATE INDEX IF NOT EXISTS idx_participant_userId ON TournamentParticipant(userId);

-- Admin-locked slots/teams. A locked slot can't be picked by players.
CREATE TABLE IF NOT EXISTS TournamentSlotLock (
  tournamentId TEXT NOT NULL REFERENCES Tournament(id) ON DELETE CASCADE,
  slotNumber   INTEGER NOT NULL,
  lockedById   TEXT NOT NULL,
  createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tournamentId, slotNumber)
);

CREATE TABLE IF NOT EXISTS Match (
  id           TEXT PRIMARY KEY,
  tournamentId TEXT NOT NULL REFERENCES Tournament(id) ON DELETE CASCADE,
  round        INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'SCHEDULED',
  createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_match_tournamentId ON Match(tournamentId);

CREATE TABLE IF NOT EXISTS MatchResult (
  id                TEXT PRIMARY KEY,
  matchId           TEXT NOT NULL REFERENCES Match(id) ON DELETE CASCADE,
  userId            TEXT NOT NULL REFERENCES User(id),
  placement         INTEGER,
  kills             INTEGER NOT NULL DEFAULT 0,
  screenshotUrl     TEXT,
  submittedAt       TEXT NOT NULL DEFAULT (datetime('now')),
  verifiedByAdminId TEXT,
  verifiedAt        TEXT,
  isDisputed        INTEGER NOT NULL DEFAULT 0,
  disputeReason     TEXT
);
CREATE INDEX IF NOT EXISTS idx_matchresult_matchId ON MatchResult(matchId);
CREATE INDEX IF NOT EXISTS idx_matchresult_userId ON MatchResult(userId);

CREATE TABLE IF NOT EXISTS Wallet (
  id             TEXT PRIMARY KEY,
  userId         TEXT UNIQUE NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  depositBalance INTEGER NOT NULL DEFAULT 0,
  winningBalance INTEGER NOT NULL DEFAULT 0,
  bonusBalance   INTEGER NOT NULL DEFAULT 0,
  lockedBalance  INTEGER NOT NULL DEFAULT 0,
  updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "Transaction" (
  id           TEXT PRIMARY KEY,
  userId       TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'PENDING',
  amount       INTEGER NOT NULL,
  balanceAfter INTEGER NOT NULL,
  referenceId  TEXT UNIQUE NOT NULL,
  description  TEXT,
  metadata     TEXT,
  createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txn_userId ON "Transaction"(userId);
CREATE INDEX IF NOT EXISTS idx_txn_type ON "Transaction"(type);
CREATE INDEX IF NOT EXISTS idx_txn_status ON "Transaction"(status);
CREATE INDEX IF NOT EXISTS idx_txn_referenceId ON "Transaction"(referenceId);

CREATE TABLE IF NOT EXISTS Deposit (
  id                 TEXT PRIMARY KEY,
  userId             TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  amount             INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'PENDING',
  razorpayOrderId    TEXT UNIQUE NOT NULL,
  razorpayPaymentId  TEXT UNIQUE,
  razorpaySignature  TEXT,
  createdAt          TEXT NOT NULL DEFAULT (datetime('now')),
  verifiedAt         TEXT
);
CREATE INDEX IF NOT EXISTS idx_deposit_userId ON Deposit(userId);
CREATE INDEX IF NOT EXISTS idx_deposit_orderId ON Deposit(razorpayOrderId);

-- Manual UPI deposits (QR + UTR + screenshot, verified by an admin).
-- Distinct from Deposit above, which is the Razorpay-gateway flow.
-- amount is integer paise like every other money column. utr is stored
-- upper-cased and is UNIQUE so the same payment reference can never be
-- submitted (or credited) twice.
CREATE TABLE IF NOT EXISTS DepositRequest (
  id            TEXT PRIMARY KEY,
  code          TEXT UNIQUE,
  userId        TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  utr           TEXT UNIQUE NOT NULL,
  screenshotUrl TEXT NOT NULL,
  paymentMethod TEXT NOT NULL DEFAULT 'UPI',
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  adminNote     TEXT,
  reviewedById  TEXT REFERENCES User(id),
  reviewedAt    TEXT,
  transactionId TEXT REFERENCES "Transaction"(id),
  createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_depreq_userId ON DepositRequest(userId);
CREATE INDEX IF NOT EXISTS idx_depreq_status ON DepositRequest(status);
CREATE INDEX IF NOT EXISTS idx_depreq_createdAt ON DepositRequest(createdAt);

CREATE TABLE IF NOT EXISTS WithdrawRequest (
  id               TEXT PRIMARY KEY,
  userId           TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'PENDING',
  upiId            TEXT,
  bankAccount      TEXT,
  ifsc             TEXT,
  reviewedById     TEXT,
  reviewedAt       TEXT,
  rejectionReason  TEXT,
  createdAt        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_withdraw_userId ON WithdrawRequest(userId);
CREATE INDEX IF NOT EXISTS idx_withdraw_status ON WithdrawRequest(status);

CREATE TABLE IF NOT EXISTS Referral (
  id             TEXT PRIMARY KEY,
  referrerId     TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  referredUserId TEXT UNIQUE NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  bonusAmount    INTEGER NOT NULL DEFAULT 0,
  bonusPaidAt    TEXT,
  createdAt      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_referral_referrerId ON Referral(referrerId);

CREATE TABLE IF NOT EXISTS Notification (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  title     TEXT NOT NULL,
  body      TEXT NOT NULL,
  data      TEXT,
  isRead    INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notification_userId ON Notification(userId);
CREATE INDEX IF NOT EXISTS idx_notification_isRead ON Notification(isRead);

CREATE TABLE IF NOT EXISTS Banner (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  imageUrl  TEXT NOT NULL,
  linkUrl   TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isActive  INTEGER NOT NULL DEFAULT 1,
  startsAt  TEXT,
  endsAt    TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS SupportTicket (
  id           TEXT PRIMARY KEY,
  userId       TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'OPEN',
  priority     TEXT NOT NULL DEFAULT 'MEDIUM',
  assignedToId TEXT,
  createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ticket_userId ON SupportTicket(userId);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON SupportTicket(status);

CREATE TABLE IF NOT EXISTS Setting (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id         TEXT PRIMARY KEY,
  actorId    TEXT REFERENCES User(id),
  action     TEXT NOT NULL,
  targetType TEXT,
  targetId   TEXT,
  metadata   TEXT,
  ipAddress  TEXT,
  createdAt  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actorId ON AuditLog(actorId);
CREATE INDEX IF NOT EXISTS idx_audit_action ON AuditLog(action);
