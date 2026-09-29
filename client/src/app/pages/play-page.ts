import { Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { findGame } from '../games';

@Component({
  selector: 'app-play-page',
  imports: [RouterLink],
  template: `
    @if (game) {
      <h1>{{ game.title }}</h1>
      <p>Игровой клиент откроется в браузере. Здесь позже будет слот на развлекательные коины.</p>
    } @else {
      <h1>Игра не найдена</h1>
    }
    <a routerLink="/games">К списку игр</a>
  `,
})
export class PlayPage {
  private readonly slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
  protected readonly game = findGame(this.slug);

  constructor() {
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
  }
}
