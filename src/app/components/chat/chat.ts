import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  signal,
  computed,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatService } from '../../services/chat.service';
import { ThemeService } from '../../services/theme.service';
import { Message, HistorySession } from '../../models/chat.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messageContainer') messageContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('pdfInput') pdfInput!: ElementRef;

  inputText = '';
  pendingImageBase64: string | null = null;
  pendingImagePreview: string | null = null;
  sidebarOpen = signal(false);
  historySessions = signal<HistorySession[]>([]);
  uploadingPDF = signal(false);
  toastMessage = signal('');
  private shouldScroll = false;
  private toastTimer: any;

  messages = computed(() => this.chatService.messages());
  isLoading = computed(() => this.chatService.isLoading());
  isDark = computed(() => this.themeService.isDark());

  constructor(
    public chatService: ChatService,
    public themeService: ThemeService,
    private router: Router,
  ) {}

  ngOnInit() {
    // Warm up Render backend so first message isn't slow
    fetch(`${environment.apiUrl}/health`).catch(() => {});

    this.loadHistory();
    if (this.messages().length === 0) {
      this.addWelcomeMessage();
    }
    const prompt = history.state?.prompt;
    const action = history.state?.action;
    if (prompt) {
      setTimeout(() => { this.inputText = prompt; }, 100);
    }
    if (action === 'photo') {
      setTimeout(() => this.triggerImageUpload(), 300);
    }
    if (action === 'pdf') {
      setTimeout(() => this.triggerPDFUpload(), 300);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3000);
  }

  addWelcomeMessage() {
    const welcome: Message = {
      id: this.chatService.generateId(),
      role: 'assistant',
      content:
        "Hi there! I'm **MathBuddy** 🦉 — your friendly math helper!\n\nTell me what math problem you're working on, and I'll help you understand it step by step using fun examples. Don't worry — there are no wrong questions here! 😊\n\nWhat are you working on today?",
      timestamp: new Date(),
    };
    this.chatService.addMessage(welcome);
    this.shouldScroll = true;
  }

  async send() {
    const text = this.inputText.trim();
    if (!text && !this.pendingImageBase64) return;
    if (this.isLoading()) return;

    const userMsg: Message = {
      id: this.chatService.generateId(),
      role: 'user',
      content: text || 'Sent a photo of my problem',
      timestamp: new Date(),
    };
    this.chatService.addMessage(userMsg);
    this.inputText = '';
    this.shouldScroll = true;

    // Add AI message bubble immediately — will be filled as tokens stream in
    const aiMsgId = this.chatService.generateId();
    this.chatService.addMessage({
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    });
    this.chatService.isLoading.set(true);

    const body = {
      message: text,
      session_id: this.chatService.currentSessionId() ?? undefined,
      ...(this.pendingImageBase64 && { image_base64: this.pendingImageBase64 }),
    };
    this.pendingImageBase64 = null;
    this.pendingImagePreview = null;

    try {
      const response = await fetch(`${environment.apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.token) {
              fullContent += data.token;
              this.chatService.messages.update(msgs =>
                msgs.map(m => m.id === aiMsgId ? { ...m, content: fullContent, isTyping: false } : m)
              );
              this.shouldScroll = true;
            }

            if (data.done) {
              this.chatService.isLoading.set(false);
              if (data.session_id) this.chatService.setSession(data.session_id);
              if (data.practice_problem) {
                this.chatService.addMessage({
                  id: this.chatService.generateId(),
                  role: 'assistant',
                  content: `🎯 **Practice Time!**\n\n${data.practice_problem}`,
                  timestamp: new Date(),
                });
              }
              this.loadHistory();
            }

            if (data.error) throw new Error(data.error);
          } catch { /* ignore parse errors on partial lines */ }
        }
      }
    } catch {
      this.chatService.messages.update(msgs => msgs.filter(m => m.id !== aiMsgId));
      this.chatService.isLoading.set(false);
      this.chatService.addMessage({
        id: this.chatService.generateId(),
        role: 'assistant',
        content: 'Oops! I had a little trouble connecting. Make sure the backend is running and try again!',
        timestamp: new Date(),
      });
      this.shouldScroll = true;
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  triggerImageUpload() {
    this.fileInput.nativeElement.click();
  }

  triggerPDFUpload() {
    this.pdfInput.nativeElement.click();
  }

  onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.pendingImageBase64 = result.split(',')[1];
      this.pendingImagePreview = result;
    };
    reader.readAsDataURL(file);
  }

  onPDFSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingPDF.set(true);
    this.chatService.uploadPDF(file).subscribe({
      next: (res) => {
        this.uploadingPDF.set(false);
        if (res.session_id) this.chatService.setSession(res.session_id);
        const msg: Message = {
          id: this.chatService.generateId(),
          role: 'assistant',
          content: `📚 **Textbook uploaded!** I've read your PDF and I'm ready to help you with questions from it. Ask me anything! 🎉`,
          timestamp: new Date(),
        };
        this.chatService.addMessage(msg);
        this.shouldScroll = true;
        this.showToast('Textbook uploaded! Ask me anything!');
      },
      error: () => {
        this.uploadingPDF.set(false);
        this.showToast('Upload failed. Make sure backend is running.');
      },
    });
  }

  removeImagePreview() {
    this.pendingImageBase64 = null;
    this.pendingImagePreview = null;
  }

  loadHistory() {
    this.chatService.getHistory().subscribe({
      next: (sessions) => this.historySessions.set(sessions),
      error: () => {},
    });
  }

  loadSession(session: HistorySession) {
    this.chatService.clearMessages();
    this.chatService.setSession(session.session_id);
    this.chatService.getSession(session.session_id).subscribe({
      next: (res) => {
        res.messages.forEach(m => this.chatService.addMessage({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        this.shouldScroll = true;
        this.sidebarOpen.set(false);
      },
    });
  }

  newChat() {
    this.chatService.clearMessages();
    this.addWelcomeMessage();
    this.sidebarOpen.set(false);
  }

  clearAllHistory() {
    this.chatService.deleteHistory().subscribe({
      next: () => {
        this.historySessions.set([]);
        this.showToast('All history cleared!');
      },
    });
  }

  goHome() {
    this.router.navigate(['/']);
  }

  scrollToBottom() {
    try {
      const el = this.messageContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formatContent(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  trackById(_: number, msg: Message) {
    return msg.id;
  }
}
