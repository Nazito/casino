import { Routes } from '@angular/router';
import { GamePage } from './pages/game-page';
import { GamesPage } from './pages/games-page';
import { HomePage } from './pages/home';
import { PlayPage } from './pages/play-page';
import { PrivacyPage } from './pages/privacy-page';
import { RulesPage } from './pages/rules-page';
import { TermsPage } from './pages/terms-page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'games', component: GamesPage },
  { path: 'games/:slug', component: GamePage },
  { path: 'play/:slug', component: PlayPage },
  { path: 'rules', component: RulesPage },
  { path: 'terms', component: TermsPage },
  { path: 'privacy', component: PrivacyPage },
];
