export interface GameCard {
  slug: string;
  title: string;
  description: string;
}

export const games: GameCard[] = [
  {
    slug: 'neon-fruits',
    title: 'Neon Fruits',
    description:
      'Слот на развлекательные коины. Коины не обмениваются на деньги, крипту или призы.',
  },
];

export function findGame(slug: string): GameCard | undefined {
  return games.find((game) => game.slug === slug);
}
