import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert hex color to HSL values for CSS custom properties
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Convert HSL values to hex color
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Apply accent color to CSS custom properties
export function applyAccentColor(hexColor: string): void {
  const { h, s, l } = hexToHSL(hexColor);
  const root = document.documentElement;

  // Set the accent color CSS variables
  root.style.setProperty('--accent-h', `${h}`);
  root.style.setProperty('--accent-s', `${s}%`);
  root.style.setProperty('--accent-l', `${l}%`);
  
  // Apply to primary color (buttons, etc.)
  root.style.setProperty('--primary', `${h} ${s}% ${Math.max(l - 10, 10)}%`);
  root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
  
  // Apply to accent variables used by Tailwind
  root.style.setProperty('--accent-color', hexColor);
  
  // Create variations for hover states and gradients
  const lighterL = Math.min(l + 10, 95);
  const darkerL = Math.max(l - 10, 5);
  
  // Generate actual hex colors for gradient support
  const lighterHex = hslToHex(h, s, lighterL);
  const darkerHex = hslToHex(h, s, darkerL);
  
  root.style.setProperty('--accent-light', `${h} ${s}% ${lighterL}%`);
  root.style.setProperty('--accent-dark', `${h} ${s}% ${darkerL}%`);
  root.style.setProperty('--accent-color-light', lighterHex);
  root.style.setProperty('--accent-color-dark', darkerHex);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPeriod(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const half = month < 6 ? 'H1' : 'H2';
  return `${year}-${half}`;
}

// Simple password hashing (for client-side use)
// Note: This is basic hashing. For production, use proper server-side hashing
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export function calculateScore(
  responses: { questionId: string; value: string | number }[],
  questions: { id: string; weight: number; type: string }[]
): { score: number; maxScore: number; details: Array<{ questionId: string; weightScore: number; percentageScore: number }> } {
  let score = 0;
  let maxScore = 0;
  const details: Array<{ questionId: string; weightScore: number; percentageScore: number }> = [];

  questions.forEach((question) => {
    const response = responses.find((r) => r.questionId === question.id);
    const maxWeightScore = question.weight * 5; // Maximum possible (5 rating × weight)
    maxScore += maxWeightScore;

    if (response && question.type === 'rating-1-5') {
      const rating = Number(response.value);
      if (rating >= 1 && rating <= 5) {
        // Weight Score = rating × weight
        const weightScore = rating * question.weight;
        // weight(%)×Score = (rating × weight) / 5
        const percentageScore = (rating * question.weight) / 5;
        
        score += weightScore;
        details.push({
          questionId: question.id,
          weightScore,
          percentageScore,
        });
      }
    } else if (response && question.type === 'rating-1-10') {
      // Convert 1-10 scale to 1-5 scale for consistency
      const rating = Number(response.value) / 2;
      if (rating >= 0.5 && rating <= 5) {
        const weightScore = rating * question.weight;
        const percentageScore = (rating * question.weight) / 5;
        score += weightScore;
        details.push({
          questionId: question.id,
          weightScore,
          percentageScore,
        });
      }
    } else if (response && (question.type === 'text' || question.type === 'multiple-choice')) {
      // Text and multiple choice contribute full weight if answered
      if (response.value && String(response.value).trim()) {
        const weightScore = question.weight * 5; // Treat as max rating
        const percentageScore = question.weight;
        score += weightScore;
        details.push({
          questionId: question.id,
          weightScore,
          percentageScore,
        });
      }
    }
  });

  return {
    score: Math.round(score * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    details,
  };
}
