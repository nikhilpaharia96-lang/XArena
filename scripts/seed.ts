/**
 * Seeds the local SQLite database with games, an admin account, and a
 * handful of realistic tournaments across different statuses/formats so
 * the UI has real data to render on first run.
 *
 * Run with: npm run db:seed
 */
import { db } from "../src/server/db/client";
import { createId, createReferralCode } from "../src/server/lib/ids";
import { hashPassword } from "../src/server/lib/auth";

async function main() {
  console.log("Seeding XArena database...");

  const games = [
    { slug: "free-fire-max", name: "Free Fire MAX", shortName: "Free Fire", modes: ["SOLO", "DUO", "SQUAD", "CLASH_SQUAD"] },
    { slug: "bgmi", name: "BGMI", shortName: "BGMI", modes: ["SOLO", "DUO", "SQUAD"] },
    { slug: "pubg-mobile", name: "PUBG Mobile", shortName: "PUBG", modes: ["SOLO", "DUO", "SQUAD"] },
    { slug: "cod-mobile", name: "Call of Duty Mobile", shortName: "COD Mobile", modes: ["ONE_V_ONE", "FOUR_V_FOUR", "CLASSIC"] },
    { slug: "valorant", name: "Valorant", shortName: "Valorant", modes: ["FOUR_V_FOUR", "CUSTOM"] },
    { slug: "efootball", name: "eFootball", shortName: "eFootball", modes: ["ONE_V_ONE"] },
    { slug: "cricket-league", name: "Cricket League", shortName: "Cricket", modes: ["ONE_V_ONE", "CUSTOM"] },
  ];

  const now = new Date().toISOString();
  const gameIds: Record<string, string> = {};

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const existing = db.prepare("SELECT id FROM Game WHERE slug = ?").get(g.slug) as { id: string } | undefined;
    if (existing) {
      gameIds[g.slug] = existing.id;
      continue;
    }
    const id = createId("game");
    gameIds[g.slug] = id;
    db.prepare(
      `INSERT INTO Game (id, slug, name, shortName, isActive, sortOrder, supportedModes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`
    ).run(id, g.slug, g.name, g.shortName, i, JSON.stringify(g.modes), now, now);
  }
  console.log(`  ✓ ${games.length} games`);

  // Admin account
  const adminEmail = "admin@xarena.app";
  let admin = db.prepare("SELECT id FROM User WHERE email = ?").get(adminEmail) as { id: string } | undefined;
  if (!admin) {
    const adminId = createId("user");
    const passwordHash = await hashPassword("Admin@12345");
    db.prepare(
      `INSERT INTO User (id, uid, email, emailVerified, passwordHash, authProvider, username, role, status, referralCode, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, ?, 'EMAIL', 'xarena_admin', 'SUPER_ADMIN', 'ACTIVE', ?, ?, ?)`
    ).run(adminId, createId(), adminEmail, passwordHash, createReferralCode(), now, now);
    db.prepare(`INSERT INTO Wallet (id, userId, updatedAt) VALUES (?, ?, ?)`).run(createId("wal"), adminId, now);
    db.prepare(`INSERT INTO PlayerStats (id, userId, updatedAt) VALUES (?, ?, ?)`).run(createId("stat"), adminId, now);
    admin = { id: adminId };
    console.log(`  ✓ admin account created — ${adminEmail} / Admin@12345 (CHANGE THIS PASSWORD before production)`);
  }

  // Sample demo player so tournaments/leaderboard aren't empty
  const demoEmail = "demo@xarena.app";
  let demo = db.prepare("SELECT id FROM User WHERE email = ?").get(demoEmail) as { id: string } | undefined;
  if (!demo) {
    const demoId = createId("user");
    const passwordHash = await hashPassword("Demo@12345");
    db.prepare(
      `INSERT INTO User (id, uid, email, emailVerified, passwordHash, authProvider, username, role, status, referralCode, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, ?, 'EMAIL', 'ProGamerX', 'USER', 'ACTIVE', ?, ?, ?)`
    ).run(demoId, createId(), demoEmail, passwordHash, createReferralCode(), now, now);
    db.prepare(`INSERT INTO Wallet (id, userId, depositBalance, winningBalance, bonusBalance, updatedAt) VALUES (?, ?, 50000, 25000, 5000, ?)`).run(
      createId("wal"),
      demoId,
      now
    );
    db.prepare(
      `INSERT INTO PlayerStats (id, userId, matchesPlayed, wins, losses, kills, headshots, totalEarnings, currentStreak, updatedAt)
       VALUES (?, ?, 42, 15, 27, 312, 89, 25000, 3, ?)`
    ).run(createId("stat"), demoId, now);
    demo = { id: demoId };
    console.log(`  ✓ demo account created — ${demoEmail} / Demo@12345`);
  }

  // Sample tournaments across statuses
  const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

  const tournaments = [
    {
      slug: "free-fire-max-mega-friday",
      title: "Free Fire MAX Mega Friday",
      description:
        "Weekly mega tournament with the biggest prize pool of the week. Squad up and battle through Bermuda for glory and cash prizes.",
      gameSlug: "free-fire-max",
      mode: "SQUAD",
      format: "PAID",
      cadence: "WEEKLY",
      status: "REGISTRATION_OPEN",
      entryFee: 4900,
      prizePool: 500000,
      prizeDistribution: [
        { position: 1, amount: 250000 },
        { position: 2, amount: 150000 },
        { position: 3, amount: 100000 },
      ],
      maxSlots: 48,
      slotsFilled: 31,
      roomSize: 4,
      map: "Bermuda",
      category: "FF_SURVIVAL",
      rules:
        "1. No teaming with rival squads.\n2. No use of hacks, mods, or emulators unless explicitly allowed.\n3. Screenshot proof of final placement required within 10 minutes of match end.\n4. Decisions by admins are final.",
      scoringSystem: "Placement points + 1 point per kill. Booyah = +12 bonus points.",
      registrationStartsAt: inHours(-24),
      registrationEndsAt: inHours(2),
      matchStartsAt: inHours(3),
      isFeatured: true,
    },
    {
      slug: "bgmi-clash-royale-cup",
      title: "BGMI Clash Royale Cup",
      description: "Daily solo showdown on Erangel. Fast-paced, high-intensity, winner takes the lion's share.",
      gameSlug: "bgmi",
      mode: "SOLO",
      format: "PAID",
      cadence: "DAILY",
      status: "REGISTRATION_OPEN",
      entryFee: 1900,
      prizePool: 80000,
      prizeDistribution: [
        { position: 1, amount: 40000 },
        { position: 2, amount: 24000 },
        { position: 3, amount: 16000 },
      ],
      maxSlots: 100,
      slotsFilled: 67,
      roomSize: 1,
      map: "Erangel",
      rules: "1. Solo entries only, no teaming.\n2. Screenshot of final rank required.\n3. Hacking results in permanent ban.",
      scoringSystem: "Top 10 placement points + kill points.",
      registrationStartsAt: inHours(-12),
      registrationEndsAt: inHours(1),
      matchStartsAt: inHours(1.5),
      isFeatured: true,
    },
    {
      slug: "cod-mobile-1v1-showdown",
      title: "COD Mobile 1v1 Showdown",
      description: "Pure skill, no teammates to blame. Best-of-3 knockout bracket.",
      gameSlug: "cod-mobile",
      mode: "ONE_V_ONE",
      format: "PAID",
      cadence: "DAILY",
      status: "REGISTRATION_OPEN",
      entryFee: 990,
      prizePool: 30000,
      prizeDistribution: [
        { position: 1, amount: 20000 },
        { position: 2, amount: 10000 },
      ],
      maxSlots: 32,
      slotsFilled: 12,
      roomSize: 1,
      map: "Nuketown",
      rules: "1. Best of 3, Search & Destroy.\n2. Both players must record gameplay.\n3. Disputes resolved via submitted footage.",
      scoringSystem: "Match win/loss knockout bracket.",
      registrationStartsAt: inHours(-6),
      registrationEndsAt: inHours(4),
      matchStartsAt: inHours(5),
      isFeatured: false,
    },
    {
      slug: "free-fire-newbie-arena",
      title: "Free Fire Newbie Arena",
      description: "Free-to-enter tournament for new players to get a feel for competitive play. No entry fee, real prizes.",
      gameSlug: "free-fire-max",
      mode: "SOLO",
      format: "FREE",
      cadence: "DAILY",
      status: "REGISTRATION_OPEN",
      entryFee: 0,
      prizePool: 20000,
      prizeDistribution: [
        { position: 1, amount: 12000 },
        { position: 2, amount: 8000 },
      ],
      maxSlots: 50,
      slotsFilled: 8,
      roomSize: 1,
      map: "Purgatory",
      category: "FF_FULL_MAP",
      rules: "1. Open to all skill levels.\n2. Fair play required — hacking results in ban.\n3. Screenshot proof required.",
      scoringSystem: "Placement based.",
      registrationStartsAt: inHours(-2),
      registrationEndsAt: inHours(6),
      matchStartsAt: inHours(7),
      isFeatured: true,
    },
    {
      slug: "free-fire-cs-scrims-night",
      title: "Free Fire CS Scrims Night",
      description: "Practice-style Clash Squad scrims for squads that want competitive reps before the big cups.",
      gameSlug: "free-fire-max",
      mode: "CLASH_SQUAD",
      format: "PAID",
      cadence: "DAILY",
      status: "REGISTRATION_OPEN",
      entryFee: 2000,
      prizePool: 60000,
      prizeDistribution: [
        { position: 1, amount: 36000 },
        { position: 2, amount: 24000 },
      ],
      maxSlots: 16,
      slotsFilled: 9,
      roomSize: 4,
      map: "Bermuda",
      category: "CS_SCRIMS",
      rules: "1. Best of 7 Clash Squad rounds.\n2. Squad of 4 required.\n3. Fair play enforced.",
      scoringSystem: "Round wins decide placement.",
      registrationStartsAt: inHours(-3),
      registrationEndsAt: inHours(3),
      matchStartsAt: inHours(4),
      isFeatured: false,
    },
    {
      slug: "free-fire-lone-wolf-duel",
      title: "Free Fire Lone Wolf Duel",
      description: "1v1 Lone Wolf knockout. Just you, your aim, and one opponent.",
      gameSlug: "free-fire-max",
      mode: "SOLO",
      format: "FREE",
      cadence: "DAILY",
      status: "REGISTRATION_OPEN",
      entryFee: 0,
      prizePool: 15000,
      prizeDistribution: [
        { position: 1, amount: 10000 },
        { position: 2, amount: 5000 },
      ],
      maxSlots: 32,
      slotsFilled: 14,
      roomSize: 2,
      map: "Lone Wolf",
      category: "LONE_WOLF",
      rules: "1. Best of 3 rounds.\n2. No emulators.\n3. Screenshot of result required.",
      scoringSystem: "Single elimination.",
      registrationStartsAt: inHours(-1),
      registrationEndsAt: inHours(5),
      matchStartsAt: inHours(6),
      isFeatured: false,
    },
    {
      slug: "valorant-squad-clash",
      title: "Valorant Squad Clash",
      description: "5v5 tactical showdown for the region's best coordinated teams.",
      gameSlug: "valorant",
      mode: "FOUR_V_FOUR",
      format: "PAID",
      cadence: "WEEKLY",
      status: "PUBLISHED",
      entryFee: 9900,
      prizePool: 300000,
      prizeDistribution: [
        { position: 1, amount: 180000 },
        { position: 2, amount: 80000 },
        { position: 3, amount: 40000 },
      ],
      maxSlots: 16,
      slotsFilled: 0,
      roomSize: 5,
      map: "Ascent",
      rules: "1. Standard competitive ruleset.\n2. All 5 players must be registered under the same team name.\n3. Match server details shared 30 minutes prior.",
      scoringSystem: "Single elimination bracket.",
      registrationStartsAt: inHours(1),
      registrationEndsAt: inHours(48),
      matchStartsAt: inHours(72),
      isFeatured: false,
    },
  ];

  for (const t of tournaments) {
    const existing = db.prepare("SELECT id FROM Tournament WHERE slug = ?").get(t.slug);
    if (existing) continue;

    const id = createId("tourn");
    db.prepare(
      `INSERT INTO Tournament (
        id, slug, title, description, gameId, mode, format, cadence, status,
        entryFee, prizePool, prizeDistribution, maxSlots, slotsFilled, roomSize, map, category, rules,
        scoringSystem, registrationStartsAt, registrationEndsAt, matchStartsAt,
        isFeatured, createdById, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      t.slug,
      t.title,
      t.description,
      gameIds[t.gameSlug],
      t.mode,
      t.format,
      t.cadence,
      t.status,
      t.entryFee,
      t.prizePool,
      JSON.stringify(t.prizeDistribution),
      t.maxSlots,
      t.slotsFilled,
      t.roomSize,
      t.map,
      (t as { category?: string }).category ?? null,
      t.rules,
      t.scoringSystem,
      t.registrationStartsAt,
      t.registrationEndsAt,
      t.matchStartsAt,
      t.isFeatured ? 1 : 0,
      admin!.id,
      now,
      now
    );
  }
  // Backfill categories on rows seeded before the column existed.
  for (const t of tournaments) {
    const c = (t as { category?: string }).category;
    if (c) db.prepare("UPDATE Tournament SET category = ? WHERE slug = ? AND category IS NULL").run(c, t.slug);
  }
  console.log(`  ✓ ${tournaments.length} sample tournaments`);

  // Completed FF tournament (below) is a survival-style BR, categorized after insert.
  // A couple of completed tournaments + verified results so the leaderboard has data
  const pastGame = gameIds["free-fire-max"];
  const pastId = createId("tourn");
  const pastSlug = "free-fire-max-thursday-throwdown-completed";
  const alreadyExists = db.prepare("SELECT id FROM Tournament WHERE slug = ?").get(pastSlug);
  if (!alreadyExists) {
    db.prepare(
      `INSERT INTO Tournament (
        id, slug, title, description, gameId, mode, format, cadence, status,
        entryFee, prizePool, prizeDistribution, maxSlots, slotsFilled, roomSize, map, rules,
        registrationStartsAt, registrationEndsAt, matchStartsAt, isFeatured, createdById, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'SOLO', 'PAID', 'WEEKLY', 'COMPLETED', 2900, 100000, ?, 40, 1, 1, 'Kalahari', 'Standard rules apply.', ?, ?, ?, 0, ?, ?, ?)`
    ).run(
      pastId,
      pastSlug,
      "Thursday Throwdown",
      "Last week's completed tournament.",
      pastGame,
      JSON.stringify([{ position: 1, amount: 60000 }, { position: 2, amount: 40000 }]),
      inHours(-96),
      inHours(-90),
      inHours(-89),
      admin!.id,
      inHours(-100),
      inHours(-89)
    );

    const participantId = createId("part");
    db.prepare(
      `INSERT INTO TournamentParticipant (id, tournamentId, userId, status, joinedAt) VALUES (?, ?, ?, 'REGISTERED', ?)`
    ).run(participantId, pastId, demo!.id, inHours(-95));

    const matchId = createId("match");
    db.prepare(
      `INSERT INTO Match (id, tournamentId, round, status, createdAt, updatedAt) VALUES (?, ?, 1, 'COMPLETED', ?, ?)`
    ).run(matchId, pastId, inHours(-89), inHours(-88));

    db.prepare(
      `INSERT INTO MatchResult (id, matchId, userId, placement, kills, screenshotUrl, submittedAt, verifiedByAdminId, verifiedAt)
       VALUES (?, ?, ?, 1, 14, 'https://placehold.co/600x400?text=Result+Proof', ?, ?, ?)`
    ).run(createId("res"), matchId, demo!.id, inHours(-88.5), admin!.id, inHours(-88));

    console.log("  ✓ 1 completed tournament with verified result for leaderboard data");
  }

  // ---------------------------------------------------------------------
  // Additional demo users (for referral chain + leaderboard variety)
  // ---------------------------------------------------------------------
  const extraUsers = [
    { email: "shadowstrike@xarena.app", username: "ShadowStrike", wins: 22, played: 55, kills: 410, earnings: 42000 },
    { email: "nightowl@xarena.app", username: "NightOwl_YT", wins: 18, played: 60, kills: 380, earnings: 31000 },
    { email: "ferociousfox@xarena.app", username: "FerociousFox", wins: 30, played: 70, kills: 520, earnings: 68000 },
  ];
  const extraUserIds: Record<string, string> = {};
  for (const u of extraUsers) {
    let row = db.prepare("SELECT id FROM User WHERE email = ?").get(u.email) as { id: string } | undefined;
    if (!row) {
      const id = createId("user");
      const passwordHash = await hashPassword("Player@12345");
      db.prepare(
        `INSERT INTO User (id, uid, email, emailVerified, passwordHash, authProvider, username, role, status, referralCode, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, ?, 'EMAIL', ?, 'USER', 'ACTIVE', ?, ?, ?)`
      ).run(id, createId(), u.email, passwordHash, u.username, createReferralCode(), now, now);
      db.prepare(`INSERT INTO Wallet (id, userId, depositBalance, winningBalance, bonusBalance, updatedAt) VALUES (?, ?, 10000, ?, 0, ?)`).run(
        createId("wal"),
        id,
        u.earnings,
        now
      );
      db.prepare(
        `INSERT INTO PlayerStats (id, userId, matchesPlayed, wins, losses, kills, headshots, totalEarnings, currentStreak, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(createId("stat"), id, u.played, u.wins, u.played - u.wins, u.kills, Math.floor(u.kills * 0.3), u.earnings, now);
      row = { id };
    }
    extraUserIds[u.username] = row.id;
  }
  console.log(`  ✓ ${extraUsers.length} additional leaderboard demo players`);
  db.prepare("UPDATE Tournament SET category = 'FF_SURVIVAL' WHERE slug = 'free-fire-max-thursday-throwdown-completed' AND category IS NULL").run();

  // ---------------------------------------------------------------------
  // Referral chain: demo user referred by admin (idempotent via UNIQUE
  // referredUserId), plus one extra user referred by demo.
  // ---------------------------------------------------------------------
  const referralPairs: [string, string][] = [
    [admin!.id, demo!.id],
    [demo!.id, extraUserIds["ShadowStrike"]],
  ];
  for (const [referrerId, referredUserId] of referralPairs) {
    const exists = db.prepare("SELECT id FROM Referral WHERE referredUserId = ?").get(referredUserId);
    if (exists) continue;
    db.prepare(
      `INSERT INTO Referral (id, referrerId, referredUserId, bonusAmount, bonusPaidAt, createdAt) VALUES (?, ?, ?, 5000, ?, ?)`
    ).run(createId("ref"), referrerId, referredUserId, now, now);
  }
  console.log(`  ✓ referral chain seeded`);

  // ---------------------------------------------------------------------
  // Sample transactions for demo user's wallet history (deposit + entry +
  // prize + referral), only inserted if the demo user has no transactions
  // yet, so re-running the seed never duplicates the ledger.
  // ---------------------------------------------------------------------
  const demoTxnCount = (
    db.prepare('SELECT COUNT(*) as c FROM "Transaction" WHERE userId = ?').get(demo!.id) as { c: number }
  ).c;
  if (demoTxnCount === 0) {
    const sampleTxns: { type: string; amount: number; balanceAfter: number; ref: string; desc: string }[] = [
      { type: "DEPOSIT", amount: 50000, balanceAfter: 50000, ref: "DEP-7F3K2L8Q", desc: "Wallet deposit via Razorpay" },
      { type: "TOURNAMENT_ENTRY", amount: 2900, balanceAfter: 47100, ref: "ENT-9K2M4P1R", desc: "Tournament entry fee" },
      { type: "TOURNAMENT_PRIZE", amount: 60000, balanceAfter: 107100, ref: "PRZ-3T7Y8U2I", desc: "Prize for placement #1" },
      { type: "REFERRAL_BONUS", amount: 5000, balanceAfter: 112100, ref: "REF-5G6H7J8K", desc: "Referral signup bonus" },
    ];
    for (const t of sampleTxns) {
      db.prepare(
        `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, createdAt)
         VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?)`
      ).run(createId("txn"), demo!.id, t.type, t.amount, t.balanceAfter, t.ref, t.desc, now);
    }
    console.log("  ✓ sample transaction history for demo user");
  }

  // ---------------------------------------------------------------------
  // Sample notifications for demo user
  // ---------------------------------------------------------------------
  const demoNotifCount = (
    db.prepare("SELECT COUNT(*) as c FROM Notification WHERE userId = ?").get(demo!.id) as { c: number }
  ).c;
  if (demoNotifCount === 0) {
    const sampleNotifs: { type: string; title: string; body: string; isRead: number }[] = [
      { type: "DEPOSIT_SUCCESS", title: "Deposit successful", body: "₹500 has been added to your wallet.", isRead: 1 },
      { type: "WINNER_ANNOUNCEMENT", title: "You won! 🏆", body: "Congratulations! You placed #1 and won ₹600.", isRead: 1 },
      { type: "TOURNAMENT_REMINDER", title: "Match starting soon", body: "Free Fire MAX Mega Friday starts in 30 minutes. Get ready!", isRead: 0 },
      { type: "ANNOUNCEMENT", title: "New feature: Daily rewards! 🎁", body: "Log in every day to claim bonus cash — check your wallet.", isRead: 0 },
    ];
    for (const n of sampleNotifs) {
      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, isRead, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(createId("notif"), demo!.id, n.type, n.title, n.body, n.isRead, now);
    }
    console.log("  ✓ sample notifications for demo user");
  }

  // ---------------------------------------------------------------------
  // Sample support ticket
  // ---------------------------------------------------------------------
  const existingTicket = db.prepare("SELECT id FROM SupportTicket WHERE userId = ?").get(demo!.id);
  if (!existingTicket) {
    db.prepare(
      `INSERT INTO SupportTicket (id, userId, subject, message, status, priority, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'OPEN', 'MEDIUM', ?, ?)`
    ).run(
      createId("tkt"),
      demo!.id,
      "Withdrawal taking longer than expected",
      "I requested a withdrawal 2 days ago and it's still pending. Can you please check the status?",
      now,
      now
    );
    console.log("  ✓ sample support ticket");
  }

  // ---------------------------------------------------------------------
  // Homepage banners
  // ---------------------------------------------------------------------
  const bannerCount = (db.prepare("SELECT COUNT(*) as c FROM Banner").get() as { c: number }).c;
  if (bannerCount === 0) {
    const banners = [
      { title: "Mega Friday — ₹5 Lakh Prize Pool", imageUrl: "https://placehold.co/1200x500/6C4CF5/white?text=Mega+Friday", linkUrl: "/tournaments/free-fire-max-mega-friday", sortOrder: 0 },
      { title: "Refer & Earn ₹50 Per Friend", imageUrl: "https://placehold.co/1200x500/2E7BFF/white?text=Refer+%26+Earn", linkUrl: "/referral", sortOrder: 1 },
      { title: "New: BGMI Daily Tournaments", imageUrl: "https://placehold.co/1200x500/00E5A0/black?text=BGMI+Daily", linkUrl: "/tournaments?game=bgmi", sortOrder: 2 },
    ];
    for (const b of banners) {
      db.prepare(
        `INSERT INTO Banner (id, title, imageUrl, linkUrl, sortOrder, isActive, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)`
      ).run(createId("banner"), b.title, b.imageUrl, b.linkUrl, b.sortOrder, now);
    }
    console.log(`  ✓ ${banners.length} homepage banners`);
  }

  // ---------------------------------------------------------------------
  // Platform settings
  // ---------------------------------------------------------------------
  const settings: [string, unknown][] = [
    ["referral_bonus_paise", 5000],
    ["min_deposit_rupees", 10],
    ["min_withdraw_rupees", 100],
    ["support_email", "support@xarena.app"],
    ["platform_commission_percent", 10],
  ];
  for (const [key, value] of settings) {
    const exists = db.prepare("SELECT key FROM Setting WHERE key = ?").get(key);
    if (!exists) {
      db.prepare(`INSERT INTO Setting (key, value, updatedAt) VALUES (?, ?, ?)`).run(key, JSON.stringify(value), now);
    }
  }
  console.log(`  ✓ platform settings`);

  console.log("\nSeed complete. Log in with:");
  console.log("  Admin → admin@xarena.app / Admin@12345");
  console.log("  Demo  → demo@xarena.app / Demo@12345");
  console.log("  Others → shadowstrike@xarena.app / nightowl@xarena.app / ferociousfox@xarena.app, all Player@12345\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
