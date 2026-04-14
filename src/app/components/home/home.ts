import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

interface Feature {
  icon: string;
  emoji: string;
  title: string;
  desc: string;
  color: string;
  action: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent {
  features: Feature[] = [
    {
      icon: 'chat', emoji: '💬',
      title: 'Type Any Problem',
      desc: 'Type any math question and get a fun, step-by-step explanation using stories and real-world examples.',
      color: '#FF6B6B', action: 'chat',
    },
    {
      icon: 'photo_camera', emoji: '📸',
      title: 'Snap Your Homework',
      desc: "Take a photo of your homework problem and MathBuddy will read it and explain it — no typing needed!",
      color: '#4ECDC4', action: 'photo',
    },
    {
      icon: 'psychology', emoji: '🧠',
      title: 'AI Teaching Mode',
      desc: 'Never just gets the answer — guides you step by step so you actually understand and remember.',
      color: '#45B7D1', action: 'chat',
    },
    {
      icon: 'emoji_events', emoji: '⭐',
      title: 'Practice & Win Stars',
      desc: 'After every lesson, get a fun practice problem. Earn stars and celebrate your progress!',
      color: '#F7DC6F', action: 'practice',
    },
    {
      icon: 'upload_file', emoji: '📚',
      title: 'Upload Your Textbook',
      desc: 'Upload your school textbook as a PDF and MathBuddy teaches from YOUR curriculum.',
      color: '#BB8FCE', action: 'pdf',
    },
    {
      icon: 'history', emoji: '💾',
      title: 'Save Your Progress',
      desc: 'Every chat is saved. Come back anytime and continue exactly where you left off.',
      color: '#82E0AA', action: 'history',
    },
  ];

  topics = [
    { emoji: '➕', label: 'Addition',       prompt: 'Help me learn addition! Can you teach me with a fun example?' },
    { emoji: '✖️', label: 'Multiplication', prompt: 'Help me learn multiplication! Can you explain it with a fun story?' },
    { emoji: '🍕', label: 'Fractions',      prompt: 'I want to learn about fractions! Can you use pizza to explain?' },
    { emoji: '📐', label: 'Geometry',       prompt: 'Help me learn geometry! Explain shapes in a fun way.' },
    { emoji: '🔢', label: 'Algebra',        prompt: 'Help me understand algebra and variables!' },
    { emoji: '📊', label: 'Statistics',     prompt: 'Can you teach me about statistics and averages?' },
    { emoji: '∫', label: 'Calculus',        prompt: 'Can you introduce me to calculus in a simple way?' },
    { emoji: '🔺', label: 'Trigonometry',   prompt: 'Help me learn trigonometry with easy examples!' },
  ];

  constructor(private router: Router, public themeService: ThemeService) {}

  startLearning() {
    this.router.navigate(['/chat']);
  }

  startTopic(prompt: string) {
    this.router.navigate(['/chat'], { state: { prompt } });
  }

  handleFeature(action: string) {
    switch (action) {
      case 'photo':
        this.router.navigate(['/chat'], { state: { action: 'photo' } }); break;
      case 'pdf':
        this.router.navigate(['/chat'], { state: { action: 'pdf' } }); break;
      case 'history':
        this.router.navigate(['/history']); break;
      case 'practice':
        this.router.navigate(['/chat'], { state: { prompt: 'Give me a fun practice math problem to solve!' } }); break;
      default:
        this.router.navigate(['/chat']); break;
    }
  }
}
