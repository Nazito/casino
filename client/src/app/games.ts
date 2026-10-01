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
      'Три барабана на развлекательные коины. Пара вишни или апельсина начисляет коины, остальные пары — нет. Три одинаковых символа начисляют больше. Коины не обмениваются на деньги.',
  },
];

export function findGame(slug: string): GameCard | undefined {
  return games.find((game) => game.slug === slug);
}
