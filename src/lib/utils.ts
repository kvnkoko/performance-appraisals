import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
