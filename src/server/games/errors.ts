export type GameErrorCode =
  | "GAME_DISABLED"
  | "INVALID_INPUT"
  | "BET_TOO_LOW"
  | "BET_TOO_HIGH"
  | "PAYOUT_TOO_HIGH"
  | "INSUFFICIENT_FUNDS"
  | "ROUND_ACTIVE"
  | "NO_ACTIVE_ROUND"
  | "WALLET_NOT_FOUND"
  | "SEED_LOCKED"
  | "NOT_FOUND";

const STATUS: Record<GameErrorCode, number> = {
  GAME_DISABLED: 403,
  INVALID_INPUT: 400,
  BET_TOO_LOW: 400,
  BET_TOO_HIGH: 400,
  PAYOUT_TOO_HIGH: 400,
  INSUFFICIENT_FUNDS: 400,
  ROUND_ACTIVE: 409,
  NO_ACTIVE_ROUND: 409,
  WALLET_NOT_FOUND: 404,
  SEED_LOCKED: 409,
  NOT_FOUND: 404,
};

export class GameError extends Error {
  readonly status: number;
  constructor(public code: GameErrorCode, message: string) {
    super(message);
    this.name = "GameError";
    this.status = STATUS[code];
  }
}
