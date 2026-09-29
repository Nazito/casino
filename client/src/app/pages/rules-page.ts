import { Component, inject } from '@angular/core';
import { Seo } from '../seo';

@Component({
  selector: 'app-rules-page',
  template: `
    <h1>Правила</h1>
    <p>Коины выдаются для игры внутри сайта и существуют только как счёт развлечения.</p>
    <p>Обмена коинов на деньги, крипту, товары и сертификаты нет. Денежных призов нет.</p>
  `,
})
export class RulesPage {
  constructor() {
    inject(Seo).apply(
      'Правила — social casino',
      'Коины нельзя вывести или обменять. Денежных призов нет.',
      '/rules',
    );
  }
}
