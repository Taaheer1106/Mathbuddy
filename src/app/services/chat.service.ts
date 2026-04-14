import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatRequest, ChatResponse, HistorySession, Message } from '../models/chat.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private apiUrl = environment.apiUrl;

  currentSessionId = signal<string | null>(null);
  messages = signal<Message[]>([]);
  isLoading = signal(false);

  constructor(private http: HttpClient) {}

  sendMessage(message: string, imageBase64?: string): Observable<ChatResponse> {
    const body: ChatRequest = {
      message,
      session_id: this.currentSessionId() ?? undefined,
      image_base64: imageBase64,
    };
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, body);
  }

  uploadPDF(file: File): Observable<{ message: string; session_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (this.currentSessionId()) {
      formData.append('session_id', this.currentSessionId()!);
    }
    return this.http.post<{ message: string; session_id: string }>(
      `${this.apiUrl}/upload`,
      formData
    );
  }

  getHistory(): Observable<HistorySession[]> {
    return this.http.get<HistorySession[]>(`${this.apiUrl}/history`);
  }

  getSession(sessionId: string): Observable<{ messages: Message[] }> {
    return this.http.get<{ messages: Message[] }>(`${this.apiUrl}/history/${sessionId}`);
  }

  deleteHistory(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/history`);
  }

  addMessage(msg: Message) {
    this.messages.update(msgs => [...msgs, msg]);
  }

  setSession(id: string) {
    this.currentSessionId.set(id);
  }

  clearMessages() {
    this.messages.set([]);
    this.currentSessionId.set(null);
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}
