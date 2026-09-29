import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { findGame } from '../games';
import { Seo } from '../seo';

@Component({
  selector: 'app-game-page',
  imports: [RouterLink],
  template: `
    @if (game) {
      <h1>{{ game.title }}</h1>
      <p>{{ game.description }}</p>
      <a [routerLink]="['/play', game.slug]">Играть</a>
    } @else {
      <h1>Игра не найдена</h1>
      <a routerLink="/games">К списку игр</a>
    }
  `,
})
export class GamePage {
  private readonly slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
  protected readonly game = findGame(this.slug);

  constructor() {
    const game = this.game;
    inject(Seo).apply(
      game ? `${game.title} — social casino` : 'Игра не найдена',
      game?.description ?? 'Такой игры нет.',
      game ? `/games/${game.slug}` : '/games',
    );
  }
}
