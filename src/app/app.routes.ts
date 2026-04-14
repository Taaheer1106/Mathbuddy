import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home').then(m => m.HomeComponent),
  },
  {
    path: 'chat',
    loadComponent: () => import('./components/chat/chat').then(m => m.ChatComponent),
  },
  {
    path: 'history',
    loadComponent: () => import('./components/history/history').then(m => m.HistoryComponent),
  },
  { path: '**', redirectTo: '' },
];
