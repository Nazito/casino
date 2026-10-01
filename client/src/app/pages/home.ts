import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Seo } from '../seo';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1>Развлекательные слоты</h1>
    <p>
      Игра на коины. Без аккаунта доступно 50 спинов. После входа коины из всех игр складываются в один
      баланс. Коины не имеют денежной ценности и не обмениваются на деньги, крипту, товары или сертификаты.
    </p>
    <a routerLink="/games">К играм</a>
  `,
})
export class HomePage {
  constructor() {
    inject(Seo).apply(
      'Развлекательные слоты на коины',
      'Бесплатная игра на коины. Денежной ценности у коинов нет, обмена на деньги нет.',
      '/',
    );
  }
}
