import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { Player, SpinResponse } from './player';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);

  readonly player = signal<Player | null>(null);

  load(): Observable<Player | null> {
    return this.http.get<Player>('/api/session').pipe(
      tap((player) => this.player.set(player)),
      catchError((error: unknown) => {
        this.player.set(null);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return of(null);
        }
        return throwError(() => error);
      }),
    );
  }

  register(username: string, password: string): Observable<Player> {
    return this.http
      .post<Player>('/api/auth/register', { username, password, adult: true })
      .pipe(tap((player) => this.player.set(player)));
  }

  login(username: string, password: string): Observable<Player> {
    return this.http
      .post<Player>('/api/auth/login', { username, password })
      .pipe(tap((player) => this.player.set(player)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(tap(() => this.player.set(null)));
  }

  claimDaily(): Observable<Player & { granted: number }> {
    return this.http.post<Player & { granted: number }>('/api/wallet/daily', {}).pipe(
      tap((player) => this.player.set(player)),
    );
  }

  spin(slug: string, stake: number): Observable<SpinResponse> {
    return this.http.post<SpinResponse>(`/api/games/${encodeURIComponent(slug)}/spin`, { stake }).pipe(
      tap((result) => {
        this.player.set({
          id: result.id,
          displayName: result.displayName,
          balance: result.balance,
          dailyAvailable: result.dailyAvailable,
          dailyGrant: result.dailyGrant,
          minStake: result.minStake,
          spins: result.spins,
        });
      }),
    );
  }
}
