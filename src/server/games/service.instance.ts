import { db } from "@/server/db/client";
import { createGameService } from "./engine";

export const gameService = createGameService(db);
