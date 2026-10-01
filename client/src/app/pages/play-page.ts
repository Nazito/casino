import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { findGame } from '../games';
import { stakes, symbolLabel } from '../player';
import { Session } from '../session';

@Component({
  selector: 'app-play-page',
  imports: [RouterLink],
  templateUrl: './play-page.html',
  styleUrl: './play-page.css',
})
export class PlayPage {
  private readonly session = inject(Session);

  private readonly slug = inject(ActivatedRoute).snapshot.paramMap.get('slug') ?? '';
  protected readonly game = findGame(this.slug);
  protected readonly stakes = stakes;
  protected readonly player = this.session.player;
  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly ready = signal(false);
  protected readonly busy = signal(false);
  protected readonly spinning = signal(false);
  protected readonly error = signal('');
  protected readonly outcome = signal('');
  protected readonly selectedStake = signal<(typeof stakes)[number]>(10);
  protected readonly reels = signal<string[]>(['seven', 'star', 'cherry']);

  private readonly subscriptions = new Subscription();
  private flickerId: number | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopFlicker();
      this.subscriptions.unsubscribe();
    });
    inject(Meta).updateTag({ name: 'robots', content: 'noindex' });
    afterNextRender(() => {
      this.track(
        this.session.load().subscribe({
          error: (error: unknown) => {
            this.error.set(this.message(error));
            this.ready.set(true);
          },
          complete: () => this.ready.set(true),
        }),
      );
    });
  }

  protected label(symbol: string): string {
    return symbolLabel[symbol] ?? symbol;
  }

  protected line(reels: string[]): string {
    return reels.map((symbol) => this.label(symbol)).join(' ');
  }

  protected switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set('');
  }

  protected submitAuth(event: Event): void {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const data = new FormData(form);
    const username = String(data.get('username') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const request =
      this.mode() === 'register'
        ? this.session.register(username, password)
        : this.session.login(username, password);

    this.error.set('');
    this.busy.set(true);
    this.track(request.subscribe({
      next: () => this.busy.set(false),
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(this.message(error));
      },
    }));
  }

  protected logout(): void {
    this.busy.set(true);
    this.track(this.session.logout().subscribe({
      next: () => {
        this.busy.set(false);
        this.outcome.set('');
        this.mode.set('login');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(this.message(error));
      },
    }));
  }

  protected claimDaily(): void {
    this.error.set('');
    this.busy.set(true);
    this.track(this.session.claimDaily().subscribe({
      next: (result) => {
        this.busy.set(false);
        this.outcome.set(`Начислено ${result.granted} коинов`);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(this.message(error));
      },
    }));
  }

  protected spin(): void {
    const player = this.player();
    if (!player || this.spinning()) {
      return;
    }
    if (this.slug !== 'neon-fruits') {
      this.error.set('Эта игра ещё не собрана.');
      return;
    }

    this.error.set('');
    this.outcome.set('');
    this.spinning.set(true);
    this.stopFlicker();
    this.flickerId = window.setInterval(() => {
      this.reels.set([pickVisual(), pickVisual(), pickVisual()]);
    }, 90);

    this.track(this.session.spin(this.slug, this.selectedStake()).subscribe({
      next: (result) => {
        this.stopFlicker();
        this.reels.set(result.reels);
        this.outcome.set(this.outcomeText(result.win, result.stake));
        this.spinning.set(false);
      },
      error: (error: unknown) => {
        this.stopFlicker();
        this.spinning.set(false);
        this.error.set(this.message(error));
      },
    }));
  }

  private outcomeText(win: number, stake: number): string {
    if (win > stake) {
      return `Начислено ${win} коинов`;
    }
    if (win === stake) {
      return 'Ставка вернулась';
    }
    return 'Мимо';
  }

  private track(subscription: Subscription): void {
    this.subscriptions.add(subscription);
  }

  private stopFlicker(): void {
    if (this.flickerId !== null) {
      window.clearInterval(this.flickerId);
      this.flickerId = null;
    }
  }

  private message(error: unknown): string {
    const code = error instanceof HttpErrorResponse ? error.error?.error : '';
    switch (code) {
      case 'database_unavailable':
        return 'MongoDB не подключена. В server/.env нужна строка удалённого кластера.';
      case 'insufficient_balance':
        return 'Не хватает коинов на эту ставку.';
      case 'invalid_username':
        return 'Логин: 3–24 символа, буквы, цифры, «_» и «-».';
      case 'invalid_password':
        return 'Пароль должен быть от 8 до 128 символов.';
      case 'username_taken':
        return 'Такой логин уже занят.';
      case 'invalid_credentials':
        return 'Неверный логин или пароль.';
      case 'too_many_attempts':
        return 'Слишком много неудачных попыток. Попробуйте через 15 минут.';
      case 'slow_down':
        return 'Слишком частые спины. Подождите минуту.';
      case 'bad_origin':
        return 'Запрос отклонён.';
      case 'invalid_stake':
        return 'Такая ставка недоступна.';
      case 'daily_not_needed':
        return 'Дневные коины выдаются, когда баланса не хватает на минимальную ставку.';
      case 'daily_already_claimed':
        return 'Дневные коины уже забраны. Следующие будут завтра.';
      default:
        return 'Не получилось выполнить запрос.';
    }
  }
}

function pickVisual(): string {
  const symbols = Object.keys(symbolLabel);
  return symbols[Math.floor(Math.random() * symbols.length)] ?? 'cherry';
}
