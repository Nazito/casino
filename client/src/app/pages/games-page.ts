import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { games } from '../games';
import { Seo } from '../seo';

@Component({
  selector: 'app-games-page',
  imports: [RouterLink],
  template: `
    <h1>Игры</h1>
    <ul>
      @for (game of games; track game.slug) {
        <li>
          <a [routerLink]="['/games', game.slug]">{{ game.title }}</a>
          <p>{{ game.description }}</p>
        </li>
      }
    </ul>
  `,
})
export class GamesPage {
  protected readonly games = games;

  constructor() {
    inject(Seo).apply(
      'Игры — social casino',
      'Список игр на развлекательные коины без денежного выигрыша.',
      '/games',
    );
  }
}
