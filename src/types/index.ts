export type AppraisalType = 
  | 'executives-to-leaders'
  | 'leaders-to-members'
  | 'members-to-leaders'
  | 'leaders-to-leaders'
  | 'members-to-members'
  | 'hr-to-all';

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

/** Executive type: operational = manages department(s); advisory = no direct department management */
export type ExecutiveType = 'operational' | 'advisory';

export type EmploymentStatus =
  | 'permanent'
  | 'temporary'
  | 'contractor'
  | 'probation'
  | 'intern'
  | 'on-leave'
  | 'terminated'
  | 'resigned';

/** Statuses that lock linked user accounts and invalidate sessions */
export const LOCKING_STATUSES: EmploymentStatus[] = ['terminated', 'resigned'];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  permanent: 'Permanent',
  temporary: 'Temporary',
  contractor: 'Contractor',
  probation: 'Probation',
  intern: 'Intern',
  'on-leave': 'On leave',
  terminated: 'Terminated',
  resigned: 'Resigned',
};

export interface Employee {
  id: string;
  name: string;
  email?: string;
  role: string; // Job title: "CEO", "CFO", "Senior Developer", etc.
  /** Hierarchy: Chairman → Executives (C-Suite) → Department Leaders → Members. HR is company-wide. */
  hierarchy: 'chairman' | 'executive' | 'leader' | 'department-leader' | 'member' | 'hr';
  /** Only for hierarchy === 'executive': operational = manages dept(s), advisory = no dept */
  executiveType?: ExecutiveType;
  /** Department/team membership (for leaders, members, HR). Legacy: use teamId. */
  teamId?: string;
  /** For operational executives: department IDs this executive oversees */
  managesDepartments?: string[];
  /** Direct manager's employee ID */
  reportsTo?: string;
  /** Employment status (e.g. Permanent, Terminated). When terminated/resigned, linked accounts are locked. */
  employmentStatus?: EmploymentStatus;
  /** Dotted-line / matrix reporting (secondary managers) */
  dottedLineReportsTo?: string[];
  /** Optional metadata */
  avatar?: string;
  phone?: string;
  location?: string;
  startDate?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Relationship type for an assignment (maps to template type or custom) */
export type AssignmentRelationshipType =
  | 'exec-to-leader'
  | 'leader-to-member'
  | 'member-to-leader'
  | 'leader-to-leader'
  | 'member-to-member'
  | 'hr-to-all'
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
  /** Operational executive who oversees this department (optional) */
  oversightExecutiveId?: string;
  /** Department leaders assigned to this team (optional; leaders also identified by employee.teamId) */
  leaderIds?: string[];
  /** Optional metadata */
  budget?: number;
  headcount?: number;
  location?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt?: string;
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
  /** Weight of HR scores in Employee of the Month / final ranking (0–100). Base score weight = 100 - hrScoreWeight. Default 30. */
  hrScoreWeight?: number;
  /** When true, include HR scores in final ranking; when false, HR is optional. Default false. */
  requireHrForRanking?: boolean;
  /** Override who was awarded Employee of the Period per review period (e.g. fairness, past wins). Key = reviewPeriodId, value = employeeId. */
  employeeOfPeriodOverrides?: Record<string, string>;
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
  'members-to-members': 'Members → Members (same department)',
  'hr-to-all': 'HR → All Employees',
};

export const HIERARCHY_LABELS: Record<Employee['hierarchy'], string> = {
  chairman: 'Chairman',
  executive: 'Executive',
  leader: 'Department Leader', // legacy; prefer department-leader
  'department-leader': 'Department Leader',
  member: 'Team Member',
  hr: 'HR Personnel',
};

/** Check if hierarchy is a department leader (legacy 'leader' or new 'department-leader') */
export function isDepartmentLeader(h: Employee['hierarchy']): boolean {
  return h === 'leader' || h === 'department-leader';
}

/** Check if hierarchy is executive (with optional type) */
export function isExecutiveHierarchy(h: Employee['hierarchy']): boolean {
  return h === 'executive';
}

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

// --- Employee Directory & Org Chart ---

export interface EmployeeProfile {
  id: string;
  employeeId: string;
  profilePicture?: string;
  /** Horizontal position for profile picture in circle (0 = left, 50 = center, 100 = right). */
  profilePicturePositionX?: number;
  /** Vertical position for profile picture in circle (0 = top, 50 = center, 100 = bottom). */
  profilePicturePositionY?: number;
  coverPhoto?: string;
  /** Vertical position for cover photo crop (0 = top, 50 = center, 100 = bottom). Used as object-position percentage. */
  coverPhotoPosition?: number;
  bio?: string;
  headline?: string;
  location?: string;
  timezone?: string;
  startDate?: string;
  birthday?: string; // MM-DD
  pronouns?: string;
  skills?: string[];
  interests?: string[];
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    website?: string;
  };
  contactPreferences?: {
    email?: boolean;
    slack?: boolean;
    phone?: boolean;
  };
  phoneNumber?: string;
  slackHandle?: string;
  funFacts?: string[];
  achievements?: string[];
  education?: { institution: string; degree: string; year?: string }[];
  previousRoles?: { title: string; company: string; duration?: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryFilters {
  search: string;
  department: string | null;
  hierarchy: string | null;
  location: string | null;
  skills: string[];
}

export interface OrgChartNode {
  employee: Employee;
  profile?: EmployeeProfile;
  children: OrgChartNode[];
  team?: Team;
  isExpanded?: boolean;
}

export interface OrgChartConfig {
  rootEmployeeId?: string | null;
  includeHierarchy: ('chairman' | 'executive' | 'leader' | 'department-leader' | 'member' | 'hr')[];
  groupByDepartment: boolean;
  sortAlphabetically?: boolean;
  maxDepth?: number;
}
