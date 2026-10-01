export interface SpinView {
  stake: number;
  win: number;
  reels: string[];
  createdAt: string;
}

export interface Player {
  id: string;
  displayName: string;
  balance: number;
  dailyAvailable: boolean;
  dailyGrant: number;
  minStake: number;
  spins: SpinView[];
}

export interface SpinResponse extends Player {
  reels: string[];
  stake: number;
  win: number;
  absorbed?: number;
}

export interface GuestState {
  guest: true;
  spinsLeft: number;
  spinLimit: number;
  stake: number;
  balance: number;
  total: number;
  minStake: number;
  spins: SpinView[];
}

export interface GuestSpin extends GuestState {
  reels: string[];
  win: number;
}

export const stakes = [10, 50, 100, 500] as const;

export const symbolLabel: Record<string, string> = {
  cherry: '🍒',
  lemon: '🍋',
  orange: '🍊',
  plum: '🍇',
  bell: '🔔',
  star: '⭐',
  seven: '7',
};
