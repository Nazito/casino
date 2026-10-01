import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { GuestSpin, GuestState, Player, SpinResponse } from './player';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);

  readonly player = signal<Player | null>(null);
  readonly guest = signal<GuestState | null>(null);

  load(slug: string): Observable<(Player & { absorbed?: number }) | null> {
    return this.http.get<Player & { absorbed?: number }>('/api/session').pipe(
      tap((player) => this.rememberPlayer(player)),
      catchError((error: unknown) => {
        this.player.set(null);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.openGuest(slug).pipe(
            catchError((guestError: unknown) => throwError(() => guestError)),
            map(() => null),
          );
        }
        return throwError(() => error);
      }),
    );
  }

  openGuest(slug: string): Observable<GuestState> {
    return this.http.post<GuestState>('/api/guest', { slug }).pipe(
      tap((guest) => {
        this.guest.set(guest);
        this.player.set(null);
      }),
    );
  }

  register(username: string, password: string): Observable<Player & { absorbed?: number }> {
    return this.http
      .post<Player & { absorbed?: number }>('/api/auth/register', { username, password, adult: true })
      .pipe(tap((player) => this.rememberPlayer(player)));
  }

  login(username: string, password: string): Observable<Player & { absorbed?: number }> {
    return this.http
      .post<Player & { absorbed?: number }>('/api/auth/login', { username, password })
      .pipe(tap((player) => this.rememberPlayer(player)));
  }

  logout(slug: string): Observable<GuestState | null> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(
      tap(() => this.player.set(null)),
      switchMap(() => this.openGuest(slug).pipe(catchError(() => of(null)))),
    );
  }

  claimDaily(): Observable<Player & { granted: number }> {
    return this.http.post<Player & { granted: number }>('/api/wallet/daily', {}).pipe(
      tap((player) => this.rememberPlayer(player)),
    );
  }

  spin(slug: string, stake: number): Observable<SpinResponse | GuestSpin> {
    return this.http.post<SpinResponse | GuestSpin>(`/api/games/${encodeURIComponent(slug)}/spin`, { stake }).pipe(
      tap((result) => {
        if (isGuestSpin(result)) {
          this.guest.set(result);
          this.player.set(null);
          return;
        }
        this.rememberPlayer(result);
      }),
    );
  }

  private rememberPlayer(player: Player): void {
    this.player.set({
      id: player.id,
      displayName: player.displayName,
      balance: player.balance,
      dailyAvailable: player.dailyAvailable,
      dailyGrant: player.dailyGrant,
      minStake: player.minStake,
      spins: player.spins,
    });
    this.guest.set(null);
  }
}

function isGuestSpin(result: SpinResponse | GuestSpin): result is GuestSpin {
  return 'guest' in result && result.guest;
}
