import { Component, afterNextRender, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly ageReady = signal(false);
  protected readonly ageOk = signal(false);
  protected readonly ageBlocked = signal(false);

  constructor() {
    afterNextRender(() => {
      this.ageOk.set(localStorage.getItem('age-ok') === '1');
      this.ageReady.set(true);
    });
  }

  protected confirmAge(): void {
    localStorage.setItem('age-ok', '1');
    this.ageOk.set(true);
  }

  protected declineAge(): void {
    this.ageBlocked.set(true);
  }
}
