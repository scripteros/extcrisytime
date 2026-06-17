export interface ApiWinner {
  screenName: string;
  winnings: number;
}

export interface ApiTopSlot {
  wheelSector: string;
  multiplier?: number;
}

export interface ApiWheelResult {
  type: "WinningNumber" | "BonusRound";
  wheelSector: string;
}

export interface ApiOutcome {
  topSlot?: ApiTopSlot | null;
  wheelResult: ApiWheelResult;
  maxMultiplier: number;
  isTopSlotMatchedToWheelResult: boolean;
}

export interface ApiGameResult {
  outcome: ApiOutcome;
}

export interface ApiTable {
  id: string;
  name: string;
}

export interface ApiDealer {
  name: string;
  uid: string;
}

export interface ApiGameData {
  id: string;
  startedAt: string;
  settledAt: string;
  status: string;
  gameType: string;
  currency: string;
  wager: number;
  payout: number;
  table: ApiTable;
  dealer: ApiDealer;
  numOfParticipants: number;
  result: ApiGameResult;
}

export interface ApiRecord {
  id: string;
  transmissionId: string;
  totalWinners: number;
  totalAmount: number;
  winners: ApiWinner[];
  data: ApiGameData;
}

// Normalized/Parsed Spin model for the frontend
export interface ParsedSpin {
  id: string;
  startedAt: string;
  settledAt: string;
  sectorKey: string; // "1" | "2" | "5" | "10" | "CoinFlip" | "Pachinko" | "CashHunt" | "CrazyTime"
  displayName: string; // "1" | "2" | "5" | "10" | "Coin Flip" | "Pachinko" | "Cash Hunt" | "Crazy Time"
  isBonus: boolean;
  maxMultiplier: number;
  isTopSlotMatched: boolean;
  topSlot?: {
    sector: string; // API sector name
    displayName: string;
    multiplier?: number;
  } | null;
  timestamp: number; // resolved mills
  totalWinners: number;
  totalAmount: number;
  dealerName: string;
  crazyTimeFlappers?: {
    Green: number;
    Blue: number;
    Yellow: number;
  };
  activeFlapperColor?: "Green" | "Blue" | "Yellow";
  bonusStageDetails?: {
    hasDoubleTriple?: boolean;
    doubleTripleType?: "Double" | "Triple" | null;
    stageSpinsCount?: number;
    subSpinsMultipliers?: number[];
    multiplierDescription?: string;
  } | null;
}

// Definition of a Sector and its theoretical parameters
export interface SectorDefinition {
  key: string; // API sector term
  displayName: string;
  color: string; // CSS Color class/Hex
  bgColor: string; // bg hex or tailwind class
  borderColor: string;
  glowColor: string;
  textClass: string;
  segments: number; // out of 54
  theoreticalProbability: number; // segments / 54
  isBonus: boolean;
}

// Global Statistics Dashboard totals
export interface GameStats {
  totalSpins: number;
  bonusCount: number;
  bonusPercentage: number;
  averageMultiplier: number;
  maxMultiplier: number;
  lastSector: string;
  lastSectorDisplayName: string;
  lastSectorTime: string;
  topSlotMatches: number;
  roundsSinceLastBonus: number;
  predictedBonusChance: number;
  predictionConfidence: "Mínima" | "Baixa" | "Moderada" | "Alta" | "Crítica";
}
