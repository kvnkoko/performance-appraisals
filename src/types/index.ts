export type AppraisalType = 
  | 'executives-to-leaders'
  | 'leaders-to-members'
  | 'members-to-leaders'
  | 'leaders-to-leaders'
  | 'members-to-members';

export type QuestionType = 'rating-1-5' | 'text' | 'multiple-choice';

export interface CategoryItem {
  id: string;
  categoryName?: string; // Sub-category name (optional, for sub-categories)
  text: string; // Description
  type: QuestionType;
  weight: number; // Weight in percentage (e.g., 3, 5, 6)
  required: boolean;
  options?: string[]; // For multiple choice
  order: number;
}

export interface Category {
  id: string;
  categoryName: string; // Category name
  items: CategoryItem[];
  order: number;
}

// Legacy Question interface for backward compatibility
export interface Question {
  id: string;
  evaluationFactor?: number;
  categoryName?: string;
  text: string;
  type: QuestionType;
  weight: number;
  required: boolean;
  options?: string[];
  order: number;
}

export const RATING_LABELS = {
  1: { label: 'Not Acceptable', color: 'red' },
  2: { label: 'Improvement Needed', color: 'amber' },
  3: { label: 'As Expected', color: 'green' },
  4: { label: 'Better Than Expected', color: 'blue' },
  5: { label: 'Outstanding', color: 'purple' },
} as const;

export interface Template {
  id: string;
  name: string; // Template name
  subtitle?: string; // Template subtitle - optional
  type: AppraisalType;
  categories: Category[]; // New structure with categories
  questions?: Question[]; // Legacy - for backward compatibility
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Employee {
  id: string;
  name: string;
  email?: string;
  role: string;
  hierarchy: 'executive' | 'leader' | 'member';
  teamId?: string; // department/team
  reportsTo?: string; // employeeId of direct manager (Leader or Executive) – for auto-assignment
  createdAt: string;
}

/** Relationship type for an assignment (maps to template type or custom) */
export type AssignmentRelationshipType =
  | 'exec-to-leader'
  | 'leader-to-member'
  | 'member-to-leader'
  | 'leader-to-leader'
  | 'custom';

/** Single appraisal assignment (auto or manual); used alongside AppraisalLink for unified dashboard */
export interface AppraisalAssignment {
  id: string;
  reviewPeriodId: string;
  appraiserId: string;
  appraiserName: string;
  employeeId: string;
  employeeName: string;
  relationshipType: AssignmentRelationshipType;
  templateId: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignmentType: 'auto' | 'manual';
  linkToken?: string; // if created from manual link, store token for URL
  createdAt: string;
  dueDate?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface AppraisalResponse {
  questionId: string;
  value: string | number;
  textFeedback?: string;
}

export interface ReviewPeriod {
  id: string;
  name: string; // "Q1 2025"
  type: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'Annual' | 'Custom';
  year: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status: 'planning' | 'active' | 'completed' | 'archived';
  description?: string;
  createdAt: string;
}

export interface Appraisal {
  id: string;
  templateId: string;
  employeeId: string; // Employee being appraised
  appraiserId: string; // Employee doing the appraisal
  reviewPeriodId: string;
  reviewPeriodName: string; // denormalized for easy display
  responses: AppraisalResponse[];
  score: number;
  maxScore: number;
  completedAt: string | null;
  createdAt: string;
}

export interface AppraisalLink {
  id: string;
  employeeId: string; // Employee being appraised
  appraiserId: string; // Employee doing the appraisal
  templateId: string;
  reviewPeriodId?: string; // Optional for backward compatibility
  reviewPeriodName?: string;
  token: string;
  expiresAt: string | null;
  used: boolean;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  logo?: string;
  adminPin: string;
  accentColor: string;
  theme: 'light' | 'dark' | 'system';
}

export interface PerformanceSummary {
  employeeId: string;
  period: string; // e.g., "2024-H1"
  totalScore: number;
  maxScore: number;
  percentage: number;
  strengths: string[];
  improvements: string[];
  narrative: string;
  breakdown: {
    type: AppraisalType;
    score: number;
    maxScore: number;
  }[];
}

export const APPRAISAL_TYPE_LABELS: Record<AppraisalType, string> = {
  'executives-to-leaders': 'Executives → Leaders',
  'leaders-to-members': 'Leaders → Members',
  'members-to-leaders': 'Members → Leaders',
  'leaders-to-leaders': 'Leaders → Leaders',
  'members-to-members': 'Members → Members',
};

export const HIERARCHY_LABELS: Record<Employee['hierarchy'], string> = {
  executive: 'Executive',
  leader: 'Leader',
  member: 'Member',
};

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Hashed password
  name: string;
  email?: string;
  role: 'admin' | 'staff';
  active: boolean;
  employeeId?: string; // Links to employee record for non-admin users
  mustChangePassword?: boolean; // Force password change on first login
  createdAt: string;
  lastLoginAt?: string;
}
