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
import { environment } from '../../../environments/environment';
import { ChatService } from '../../services/chat.service';
import { ThemeService } from '../../services/theme.service';
import { Message, HistorySession } from '../../models/chat.model';

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

  send() {
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

    const typingMsg: Message = {
      id: 'typing',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    };
    this.chatService.addMessage(typingMsg);
    this.chatService.isLoading.set(true);

    this.chatService.sendMessage(text, this.pendingImageBase64 ?? undefined).subscribe({
      next: (res) => {
        this.chatService.messages.update(msgs => msgs.filter(m => m.id !== 'typing'));
        this.chatService.isLoading.set(false);

        if (res.session_id) {
          this.chatService.setSession(res.session_id);
        }

        const aiMsg: Message = {
          id: this.chatService.generateId(),
          role: 'assistant',
          content: res.reply,
          timestamp: new Date(),
        };
        this.chatService.addMessage(aiMsg);

        if (res.practice_problem) {
          const practiceMsg: Message = {
            id: this.chatService.generateId(),
            role: 'assistant',
            content: `🎯 **Practice Time!**\n\n${res.practice_problem}`,
            timestamp: new Date(),
          };
          this.chatService.addMessage(practiceMsg);
        }

        this.pendingImageBase64 = null;
        this.pendingImagePreview = null;
        this.shouldScroll = true;
        this.loadHistory();
      },
      error: () => {
        this.chatService.messages.update(msgs => msgs.filter(m => m.id !== 'typing'));
        this.chatService.isLoading.set(false);
        const errMsg: Message = {
          id: this.chatService.generateId(),
          role: 'assistant',
          content: "Oops! I had a little trouble connecting. Make sure the backend is running and try again!",
          timestamp: new Date(),
        };
        this.chatService.addMessage(errMsg);
        this.shouldScroll = true;
      },
    });
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
