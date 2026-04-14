export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  image_base64?: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  practice_problem?: string;
}

export interface HistorySession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}
