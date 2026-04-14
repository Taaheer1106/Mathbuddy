import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatService } from '../../services/chat.service';
import { ThemeService } from '../../services/theme.service';
import { HistorySession } from '../../models/chat.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class HistoryComponent implements OnInit {
  sessions = signal<HistorySession[]>([]);
  loading = signal(true);

  constructor(
    private chatService: ChatService,
    public themeService: ThemeService,
    private router: Router
  ) {}

  ngOnInit() {
    this.chatService.getHistory().subscribe({
      next: (s) => { this.sessions.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openSession(session: HistorySession) {
    this.chatService.clearMessages();
    this.chatService.setSession(session.session_id);
    this.chatService.getSession(session.session_id).subscribe({
      next: (res) => {
        res.messages.forEach(m =>
          this.chatService.addMessage({ ...m, timestamp: new Date(m.timestamp) })
        );
        this.router.navigate(['/chat']);
      },
    });
  }

  goChat() { this.router.navigate(['/chat']); }
  goHome() { this.router.navigate(['/']); }
}
