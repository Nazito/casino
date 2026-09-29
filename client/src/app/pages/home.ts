import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../seo';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1>Social casino</h1>
    <p>
      Игра на развлекательные коины. Коины нельзя вывести, обменять на деньги, крипту, товары
      или подарочные сертификаты.
    </p>
    <a routerLink="/games">К играм</a>
  `,
})
export class HomePage {
  constructor() {
    inject(Seo).apply(
      'Social casino — развлекательные коины',
      'Бесплатная игра в духе казино. Коины не имеют денежной стоимости и не выводятся.',
      '/',
    );
  }
}
