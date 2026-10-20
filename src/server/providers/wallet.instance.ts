import { db } from "@/server/db/client";
import { createProviderWallet } from "./provider-wallet";

/** Process-wide wallet engine bound to XArena's real database. */
export const providerWallet = createProviderWallet(db);
