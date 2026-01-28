# Software Requirements Specification (SRS)
## Performance Appraisal System

**Version:** 2.0  
**Status:** Finalized  
**Last updated:** January 2026

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [System Overview and Architecture](#2-system-overview-and-architecture)
3. [Actors and Roles](#3-actors-and-roles)
4. [Functional Requirements by Module](#4-functional-requirements-by-module)
5. [Data Model](#5-data-model)
6. [Key Workflows](#6-key-workflows)
7. [Routes and Navigation](#7-routes-and-navigation)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [External Interfaces](#9-external-interfaces)
10. [Document References](#10-document-references)

---

## 1. Purpose and Scope

### 1.1 Purpose

This document describes the functional and non-functional requirements of the **Performance Appraisal System**: a web application that enables organizations to run structured performance reviews. The system supports:

- **Administrators** in defining appraisal templates, managing employees and teams, creating review periods, generating appraisal assignments (manually or automatically from org structure), and viewing analytics and historical reviews.
- **Staff (employees)** in viewing their dashboard, completing assigned appraisals, and viewing their own performance summary with an AI-generated narrative.

The system is designed for deployment as a single-page application (SPA) with optional cloud persistence via Supabase, or local-only operation using IndexedDB.

### 1.2 Scope

**In scope:**

- **Authentication:** Username/password login and optional admin PIN; session in `localStorage`; first-login password change; rejection of inactive users; cross-tab session invalidation when a user is deleted.
- **User and employee management:** CRUD for users (admin/staff) and employees; linking/unlinking user accounts to employee records; optional auto-create login when adding an employee.
- **Organization structure:** Teams (departments) and department leaders (executives or leaders whose `teamId` equals the team); employee hierarchy (executive, leader, member, HR) and Reports To for auto-assignment.
- **Review periods:** CRUD for periods (Q1–Q4, H1, H2, Annual, Custom) with status (planning, active, completed, archived).
- **Templates:** CRUD for appraisal templates with categories and items (rating 1–5, text, multiple-choice), weights, required flag, and types aligned to relationship types (Leader→Member, Member→Leader, Leader→Leader, Executive→Leader, HR→All).
- **Appraisal links and assignments:** Manual creation of individual appraisal links (tokenized URL); auto-generation of assignments from org structure with live preview; pairing rules (Reports To, same-team, department heads, peer leaders, executives→leaders, HR→all); assignments drive Pending/Completed counts and My Appraisals.
- **Completion of appraisals:** Form access by assignment ID (logged-in) or by token (link); submission records appraisal with score and `completedAt`; assignment status updated to completed.
- **Reviews and analytics:** Aggregate scores by period and optional employee filter; narrative/AI summary per employee and period (strengths, improvements, percentage); admin Reviews page and employee My Performance page.
- **Historical reviews:** View past review data (completed appraisals, scores, summaries) with filters.
- **Submission tracker:** Filterable list of assignments with status (pending, in-progress, completed), scores, and submission dates.
- **Employee portal:** My Dashboard (pending/completed counts, active periods, actionable items); My Appraisals (list of assignments and completed appraisals); My Performance (aggregated scores, category breakdown, AI narrative for selected period).
- **Settings:** Company name, admin PIN, theme (light/dark/system), accent color, HR score weight and require-HR-for-ranking; export/import; Supabase sync; sign out.
- **Deployment:** Vite build; deploy to Vercel; optional Supabase backend via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Out of scope:**

- Native mobile applications.
- SSO/OAuth or third-party identity providers.
- Payroll or HRIS integration.
- Advanced analytics beyond the defined reviews, historical views, and submission tracker.

---

## 2. System Overview and Architecture

### 2.1 Technology Stack

- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS.
- **State:** React context (AppContext for global data, UserContext for auth, ToastContext for notifications); no separate state library.
- **Persistence:** IndexedDB via `idb` (local); when Supabase is configured, the app uses Supabase as the source of truth for reads and writes for all entities (templates, employees, teams, users, review periods, appraisals, links, assignments, settings, performance summaries).
- **Session:** `localStorage` (authenticated, userId, username, userName, userEmail, userRole, employeeId); BroadcastChannel for cross-tab “user deleted” events.

### 2.2 High-Level Flow

1. User visits the app → DB initialized (IndexedDB); optional sample data loaded if empty.
2. Unauthenticated users are redirected to `/auth`. After login (username/password or admin PIN), session is stored and user is redirected by role (admin → `/dashboard`, staff → `/my-dashboard`).
3. On each load, `UserProvider` validates the current user (e.g. `getUser(userId)`). If the user is not found (deleted), session is cleared and the user is redirected to `/auth`.
4. Admin users access Overview, Templates, Employees, Teams, Users, Appraisal Links, Review Periods, Reviews, Historical Reviews, Submission Tracker, and Settings. Staff users access My Dashboard, My Appraisals, My Performance, and Settings.
5. Appraisal assignments are created manually (single link) or via auto-generate (period + options + template mapping). Assignments appear in admin Submission Tracker and in staff My Appraisals; completing a form creates an Appraisal record and marks the assignment completed.
6. Reviews and My Performance use completed appraisals to compute scores and call the AI summary logic (strengths, improvements, narrative).

### 2.3 Key Directories and Files

| Path | Purpose |
|------|--------|
| `src/App.tsx` | Route definitions, PrivateRoute, AdminRoute, role-based redirect, sample data init. |
| `src/contexts/app-context.tsx` | Global data (templates, employees, teams, users, periods, appraisals, links, assignments, settings), refresh, loading. |
| `src/contexts/user-context.tsx` | Current user, employee, logout, session validation, BroadcastChannel for user deleted, helpers (isAdmin, isExecutive, etc.). |
| `src/lib/storage.ts` | IndexedDB init, CRUD for all entities; when Supabase is configured, delegates to supabase-storage. |
| `src/lib/supabase-storage.ts` | Supabase CRUD and column mapping (snake_case ↔ camelCase). |
| `src/lib/auto-assignment.ts` | Preview and build appraisal assignments from employees (Leader→Member, Member→Leader, Leader→Leader, Exec→Leader, HR→All). |
| `src/lib/ai-summary.ts` | Generate performance narrative, strengths, improvements from completed appraisals. |
| `src/types/index.ts` | All TypeScript types (User, Employee, Team, Template, Appraisal, AppraisalAssignment, etc.). |

---

## 3. Actors and Roles

### 3.1 User Roles (Stored on User)

| Actor | Description | Main capabilities |
|-------|-------------|-------------------|
| **Administrator** | User with `role === 'admin'`. | Full access to admin pages: Overview, Templates, Employees, Teams, Users, Appraisal Links, Review Periods, Reviews, Historical Reviews, Submission Tracker, Settings. Can log in via username/password or admin PIN (if PIN matches Company Settings). |
| **Staff (Employee)** | User with `role === 'staff'`. Optionally linked to an Employee via `user.employeeId`. | Access to employee portal: My Dashboard, My Appraisals, My Performance, Settings. Sees only own assignments and own performance data. |

### 3.2 Logical Roles (Stored on Employee)

These are used for auto-assignment and access logic; they are attributes of the **Employee** record, not the User.

| Role | `hierarchy` | Description |
|------|-------------|-------------|
| **Executive** | `executive` | Can lead a department (by having `teamId` set to that team). In auto-assignment, executives who lead a department appraise leaders in that department (Exec→Leader). Executives are also treated as managers for Leader→Member when they have `teamId` and members in that team. |
| **Leader** | `leader` | Leads a department (same: `teamId` = team). Appraises members (Leader→Member); is appraised by members (Member→Leader), by other leaders (Leader→Leader), and by executives (Exec→Leader). |
| **Member** | `member` | Has a manager via Reports To or same-team leader/executive. Appraises their leader(s) (Member→Leader). |
| **HR** | `hr` | When “HR→All” is enabled in auto-generate, each HR employee is assigned to appraise all non-HR employees. |

### 3.3 Department Leaders

- **Department leaders** are employees with `hierarchy === 'leader'` or `hierarchy === 'executive'` and `teamId` set to that team’s id.
- Assignment is done from the **Teams** page: edit team → “Add leader” assigns an employee to the team (`updateEmployeeTeam(employeeId, teamId)`), i.e. sets `employee.teamId = teamId`. Removing a leader sets `employee.teamId = null`.
- Auto-assignment uses these leaders (and Reports To) to determine who appraises whom (see Auto-Assignment rules).

---

## 4. Functional Requirements by Module

### 4.1 Authentication (Auth)

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-AUTH-1 | Support login by **username + password**. | Passwords hashed (bcrypt-style). Lookup by `getUserByUsername(username)`; verify with `verifyPassword(password, user.passwordHash)`. |
| FR-AUTH-2 | Support optional **admin PIN** login. | PIN from Company Settings (`settings.adminPin`). If PIN matches, treat as admin: set session with role admin, redirect to `/dashboard`. |
| FR-AUTH-3 | Enforce **first-login password change** when `user.mustChangePassword === true`. | After successful login, redirect to password-change flow; user must set a new password before accessing the app. |
| FR-AUTH-4 | Reject login for **inactive** users (`user.active === false`). | Toast: “Account disabled”. |
| FR-AUTH-5 | After successful login, store in **localStorage**: `authenticated`, `userId`, `username`, `userName`, `userEmail`, `userRole`, `employeeId`. Redirect **admin** to `/dashboard`, **staff** to `/my-dashboard`. | |

### 4.2 Session and User Context

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-SES-1 | On each load (UserProvider), **validate current user** via `getUser(userId)`. | If user not found (deleted), clear all session keys and set user/employee to null; user is effectively logged out and will be redirected to `/auth` by PrivateRoute. |
| FR-SES-2 | When a user is **deleted**, broadcast `userDeleted` on BroadcastChannel `appraisals-auth` with `{ type: 'userDeleted', userId }`. | Other tabs with the same `userId` clear session and set user/employee to null so they log out immediately. |
| FR-SES-3 | **Logout** clears: `authenticated`, `userId`, `username`, `userName`, `userEmail`, `userRole`, `employeeId`. | Used from Sidebar and Settings. |
| FR-SES-4 | When the current user is **updated** (e.g. admin links/unlinks employee), fire `userUpdated` CustomEvent with `{ userId }`. | UserProvider refreshes so this tab gets updated `user` and `employeeId`. |

### 4.3 Dashboard (Admin Overview)

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-DASH-1 | Show **summary counts**: Templates, Employees, Pending (assignments with status pending or in-progress), Completed (appraisals with `completedAt`), Active Links (unused, not expired). | Optionally show HR assignment counts (total and completed). |
| FR-DASH-2 | Show **Average Scores by Template** (bar chart). | Only templates that have at least one completed appraisal; average of (score/maxScore)*100 per template. |
| FR-DASH-3 | Show **Recent Completions** list. | Latest completed appraisals (employee name, date, score); only where employee still exists. |
| FR-DASH-4 | Provide **Quick Actions**: e.g. Create Template, Generate Links, View Reviews. | Links to Templates, Links, Reviews. |

### 4.4 Templates

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-TMPL-1 | CRUD for **appraisal templates**. | Fields: name, subtitle, type (AppraisalType), categories (array of Category with items: text, type rating-1-5 | text | multiple-choice, weight, required, options?, order). |
| FR-TMPL-2 | Template **type** aligns with relationship types used in auto-assignment. | Types: `executives-to-leaders`, `leaders-to-members`, `members-to-leaders`, `leaders-to-leaders`, `members-to-members`, `hr-to-all`. |

### 4.5 Employees

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-EMP-1 | CRUD for **employees**. | Name, email, role (title), hierarchy (executive | leader | member | hr), teamId, reportsTo (employeeId of direct manager). |
| FR-EMP-2 | **Team** and **Reports To** are editable. | Team = department; Reports To = direct manager. Used for auto-assignment (Leader→Member, Member→Leader). |
| FR-EMP-3 | **Department leaders:** assign executives or leaders to a team by setting `employee.teamId` to the team id. | Done from Teams page (Add leader / Remove leader) or implicitly when editing employee’s team. |
| FR-EMP-4 | **Link user account** to employee (and unlink). | From User dialog: “Link Employee”; from Employee dialog: “Link User” / “Unlink User”. Persisted as `user.employeeId`. After unlink, UI shows “No employee linked” and list refreshes. |
| FR-EMP-5 | Option to **auto-create login account** when adding an employee. | Creates user with role staff, links by employeeId, shows credentials once. |

### 4.6 Teams

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-TEAM-1 | CRUD for **teams**. | Name, description. |
| FR-TEAM-2 | **Department leaders:** assign employees (executives or leaders) as leaders of the team. | Implemented by setting each leader’s `teamId` to this team. UI: “Add leader” calls `updateEmployeeTeam(employeeId, teamId)`; “Remove” sets `teamId` to null. |
| FR-TEAM-3 | Show **members** of the team. | Employees with `teamId === team.id`. |

### 4.7 Users

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-USR-1 | CRUD for **users**. | Username (unique), name, email, role (admin | staff), active, password (optional on edit). |
| FR-USR-2 | **Link / Unlink** user to an employee. | Link sets `user.employeeId = employee.id`; Unlink clears `user.employeeId`. Parent list and edit state refresh after save. |
| FR-USR-3 | **Delete user.** | Remove user from storage/Supabase; broadcast `userDeleted`; any tab with that userId clears session. |

### 4.8 Appraisal Links and Auto-Assignment

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-LINK-1 | **Manual links:** create individual appraisal links (appraiser, employee, template, period, optional due date). | Generates tokenized URL; stores AppraisalLink and optionally an AppraisalAssignment with `linkToken` and assignmentType manual. |
| FR-LINK-2 | **Auto-generate** from org structure. | Select period; options: include Leader→Leader, Exec→Leader, HR→All; live preview of pair counts (leaderToMember, memberToLeader, leaderToLeader, execToLeader, hrToAll) and warnings. |
| FR-LINK-3 | **Pairing rules:** | **Leader→Member:** For each member, managers = Reports To (if set) + same-team leaders/executives; also ensure every department head (leader/exec with teamId) gets all members in that team. **Member→Leader:** Reverse of Leader→Member (member appraises each of their managers). **Leader→Leader:** Every leader appraises every other leader (company-wide). **Exec→Leader:** Every executive appraises every leader. **HR→All:** Every HR employee appraises every non-HR employee. |
| FR-LINK-4 | **Warnings** when members have no Reports To and no team, or managers have no direct reports. | Shown in preview to guide data completion. |
| FR-LINK-5 | Generated links/assignments create **AppraisalAssignment** records. | Assignments drive Pending on dashboard and My Appraisals; status pending | in-progress | completed. |

### 4.9 Review Periods

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-PER-1 | CRUD for **review periods**. | Name, type (Q1–Q4, H1, H2, Annual, Custom), year, startDate, endDate, status (planning | active | completed | archived), description. |

### 4.10 Reviews (Analytics)

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-REV-1 | **Aggregate scores** by period and optional employee filter. | |
| FR-REV-2 | **Narrative / AI summary** per employee and period. | Generated from completed appraisals via `generatePerformanceSummary(employeeId, appraisals)` (strengths, improvements, narrative, percentage). Shown in admin Reviews and in employee My Performance. |

### 4.11 Historical Reviews

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-HIST-1 | View **past review data** (completed appraisals, scores, summaries). | Filter by period, employee, etc. |

### 4.12 Submission Tracker

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-SUB-1 | List **assignments** with filters (period, template, appraiser, employee). | Show assignment id, period, template, appraiser, employee, status (pending / in-progress / completed), score and submitted date when completed. |
| FR-SUB-2 | Support **pagination** for large lists. | e.g. PAGE_SIZE 50. |

### 4.13 Settings

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-SET-1 | **Company:** name, admin PIN. | Logo optional if supported. |
| FR-SET-2 | **Theme:** light / dark / system. | Persisted in settings and applied globally. |
| FR-SET-3 | **Accent color** for UI. | Persisted and applied globally (sidebar, buttons, etc.). |
| FR-SET-4 | **HR options:** hrScoreWeight (0–100), requireHrForRanking. | Used for ranking/weighting when applicable. |
| FR-SET-5 | **Export / Import** of data; **Supabase sync** (pull from Supabase) when configured. | |
| FR-SET-6 | **Sign out** clears session and redirects to `/auth`. | Uses same logout that clears all session keys including employeeId. |

### 4.14 Employee Portal – My Dashboard

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-MD-1 | Show **pending** and **completed** counts for the current user (from assignments where appraiserId matches current user’s employeeId, and completed appraisals). | |
| FR-MD-2 | List **active review periods** and **actionable** items (e.g. “Complete appraisal” links to assignment form). | |

### 4.15 Employee Portal – My Appraisals

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-MA-1 | List **assignments** the user must complete (appraiserId = current user’s employeeId) and **completed** appraisals. | |
| FR-MA-2 | Open **appraisal form** by assignment (`/appraisal/assignment/:assignmentId`) or by tokenized link (`/appraisal/:token`). | |

### 4.16 Employee Portal – My Performance

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-MP-1 | **Aggregated performance** for the logged-in employee: scores, strengths, areas for growth, breakdown by category. | Based on completed appraisals where `appraisal.employeeId === current employeeId` for the selected period. |
| FR-MP-2 | **Narrative / AI summary** for the selected period. | Same `generatePerformanceSummary` logic; shown in a dedicated card. |

---

## 5. Data Model

### 5.1 Entity Summary

| Entity | Key fields | Storage |
|--------|------------|---------|
| **User** | id, username, passwordHash, name, email, role, active, employeeId?, mustChangePassword?, createdAt, lastLoginAt | users |
| **Employee** | id, name, email, role, hierarchy, teamId?, reportsTo?, createdAt | employees |
| **Team** | id, name, description?, createdAt | teams |
| **ReviewPeriod** | id, name, type, year, startDate, endDate, status, description?, createdAt | reviewPeriods |
| **Template** | id, name, subtitle?, type, categories, questions?, createdAt, updatedAt, version | templates |
| **Appraisal** | id, templateId, employeeId, appraiserId, reviewPeriodId, reviewPeriodName, responses, score, maxScore, completedAt?, createdAt | appraisals |
| **AppraisalLink** | id, employeeId, appraiserId, templateId, reviewPeriodId?, reviewPeriodName?, token, expiresAt?, used, createdAt | links |
| **AppraisalAssignment** | id, reviewPeriodId, appraiserId, appraiserName, employeeId, employeeName, relationshipType, templateId, status, assignmentType, linkToken?, createdAt, dueDate? | appraisalAssignments |
| **CompanySettings** | name, logo?, adminPin, accentColor, theme, hrScoreWeight?, requireHrForRanking? | settings (key: single key e.g. 'company') |
| **PerformanceSummary** | employeeId, period, totalScore, maxScore, percentage, strengths, improvements, narrative, breakdown | summaries |

### 5.2 Types (from `src/types/index.ts`)

- **AppraisalType:** `executives-to-leaders` | `leaders-to-members` | `members-to-leaders` | `leaders-to-leaders` | `members-to-members` | `hr-to-all`
- **QuestionType:** `rating-1-5` | `text` | `multiple-choice`
- **CategoryItem:** id, categoryName?, text, type, weight, required, options?, order
- **Category:** id, categoryName, items (CategoryItem[]), order
- **Template:** id, name, subtitle?, type (AppraisalType), categories (Category[]), questions? (legacy), createdAt, updatedAt, version
- **Employee.hierarchy:** `executive` | `leader` | `member` | `hr`
- **AssignmentRelationshipType:** `exec-to-leader` | `leader-to-member` | `member-to-leader` | `leader-to-leader` | `hr-to-all` | `custom`
- **AppraisalAssignment.status:** `pending` | `in-progress` | `completed`
- **AppraisalAssignment.assignmentType:** `auto` | `manual`
- **ReviewPeriod.type:** Q1 | Q2 | Q3 | Q4 | H1 | H2 | Annual | Custom
- **ReviewPeriod.status:** planning | active | completed | archived

### 5.3 IndexedDB (idb)

- **Database name:** `appraisal-db`, version 5.
- **Object stores:** templates, employees, appraisals, links, settings, summaries, reviewPeriods, users, teams, appraisalAssignments.
- **Indexes:** users (by-username unique, by-employeeId); links (token unique); reviewPeriods (status, year); appraisalAssignments (by-period, by-appraiser).

### 5.4 Supabase Schema (Reference)

- **users:** id, username, password_hash, name, email, role, active, employee_id, must_change_password, created_at, last_login_at
- **employees:** id, name, email, role, hierarchy, team_id, reports_to, created_at
- **teams:** id, name, description, created_at
- **review_periods:** id, name, type, year, start_date, end_date, status, description, created_at
- **templates:** id, name, subtitle, type, categories (JSONB), questions (JSONB), created_at, updated_at, version
- **appraisals:** id, template_id, employee_id, appraiser_id, review_period_id, review_period_name, responses (JSONB), score, max_score, completed_at, created_at
- **appraisal_links:** id, employee_id, appraiser_id, template_id, review_period_id, review_period_name, token, expires_at, used, created_at
- **appraisal_assignments:** id, review_period_id, appraiser_id, appraiser_name, employee_id, employee_name, relationship_type, template_id, status, assignment_type, link_token, created_at, due_date
- **settings:** key (PK), name, logo, admin_pin, accent_color, theme, hr_score_weight, require_hr_for_ranking, updated_at
- **performance_summaries:** employee_id (PK), summary_text, insights (JSONB), generated_at

See `supabase-setup-complete.sql`, `supabase-add-teams.sql`, `supabase-appraisal-assignments.sql`, `supabase-hr-hierarchy.sql`, `supabase-settings-hr-columns.sql` for full DDL and migrations.

---

## 6. Key Workflows

### 6.1 Login

1. User opens `/auth`; chooses PIN or username/password.
2. **PIN:** Compare input to `settings.adminPin`; if match, set localStorage (authenticated, userId e.g. 'pin-admin', userRole admin) and redirect to `/dashboard`.
3. **Username/password:** `getUserByUsername(username)`; if not found or !active, show error. Else `verifyPassword(password, user.passwordHash)`; if invalid, show error. If `user.mustChangePassword`, show password-change form; on success update user and set session, then redirect by role. Otherwise set session (userId, username, userName, userEmail, userRole, employeeId) and redirect admin→`/dashboard`, staff→`/my-dashboard`.

### 6.2 Session Validation

1. On load, UserProvider runs refresh(): reads `localStorage.authenticated` and `userId`. If authenticated and userId is not PIN, call `getUser(userId)`.
2. If user is null (deleted), clear all session keys and set user/employee to null.
3. If user exists, set user and load employee by `user.employeeId`; update localStorage with latest user fields.

### 6.3 User Deleted (Cross-Tab)

1. Admin deletes user in Users page → user removed from storage; broadcast on BroadcastChannel `appraisals-auth`: `{ type: 'userDeleted', userId }`.
2. Any tab where `localStorage.userId === userId` receives message and clears session and sets user/employee to null, so that tab is logged out.

### 6.4 Unlink User–Employee

1. Admin opens User (or Employee) dialog and clicks Unlink.
2. Set `user.employeeId = undefined`, save user, call parent onSave(updatedUser); parent refreshes list and updates editing state. UI shows “No employee linked” without repopulating from stale data.

### 6.5 Auto-Assignment

1. Admin goes to Appraisal Links, selects “Auto-generate”, selects period and options (Leader→Leader, Exec→Leader, HR→All).
2. Live preview: `previewAutoAssignments(employees, periodId, options)` returns leaderToMember, memberToLeader, leaderToLeader, execToLeader, hrToAll and warnings.
3. Admin clicks Next, maps each relationship type to a template (and optionally sets due date).
4. On Generate, `buildAssignmentsFromPreview(preview, templateMapping, periodId, periodName, dueDate)` produces AppraisalAssignment[]; `saveAppraisalAssignments(built)` persists them; refresh() updates UI. Assignments appear in Submission Tracker and in each appraiser’s My Appraisals.

### 6.6 Complete Appraisal (by Assignment)

1. Staff opens My Appraisals and clicks an assignment → navigate to `/appraisal/assignment/:assignmentId`.
2. Load assignment, template, employee (being appraised), appraiser; if assignment status is completed, show “Already completed”. Otherwise render form from template categories/items.
3. User fills form; on submit compute score, create Appraisal (completedAt = now), update assignment status to completed, save both, refresh, show success and redirect or show “Completed”.

### 6.7 Complete Appraisal (by Token Link)

1. User opens `/appraisal/:token` (may be unauthenticated for flexibility). Load link by token; load template, employee, appraiser, period. If link used or expired, show message. Otherwise render form; on submit create Appraisal, mark link used, optionally create/update assignment, show success.

### 6.8 My Performance

1. Staff opens My Performance; employeeId = user.employeeId (or linked employee). Load completed appraisals where employeeId === current employee; get unique periods and select one (e.g. most recent).
2. For selected period, filter appraisals; call `generatePerformanceSummary(employeeId, periodAppraisals)` to get strengths, improvements, narrative, percentage. Display scores, category breakdown, and narrative card.

---

## 7. Routes and Navigation

### 7.1 Public

- `/auth` – Login (username/password or admin PIN); password change if mustChangePassword.

### 7.2 By Token (No Auth Required)

- `/appraisal/:token` – Appraisal form by link token.

### 7.3 Private (Authenticated)

- `/appraisal/assignment/:assignmentId` – Appraisal form by assignment (logged-in appraiser).
- `/*` under MainLayout:
  - **Admin only:** `/dashboard`, `/templates`, `/employees`, `/teams`, `/users`, `/links`, `/periods`, `/reviews`, `/historical`, `/submission-tracker`.
  - **Shared:** `/settings`.
  - **Employee:** `/my-dashboard`, `/my-appraisals`, `/my-performance`. If admin visits `/my-dashboard`, redirect to `/dashboard`.
- `/` and unmatched paths: redirect to `/dashboard` (admin) or `/my-dashboard` (staff).

### 7.4 Sidebar

- **Admin:** Overview, Templates, Employees, Teams, Users, Appraisal Links, Review Periods, Reviews, Historical Reviews, Submission Tracker, Settings.
- **Staff:** My Dashboard, My Appraisals, My Performance, Settings.

---

## 8. Non-Functional Requirements

- **UI/UX:** Minimal, clear layout; light and dark themes; accent color from settings; responsive (sidebar + main content); mobile menu for small screens.
- **Accessibility:** Semantic structure; focus and contrast as implemented.
- **Deployment:** Build via Vite; deploy to Vercel; optional Supabase backend via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Security:** Passwords hashed; session in localStorage; no credentials in logs; sensitive debug logging removed or reduced.
- **Performance:** Pagination on Submission Tracker; lazy-loading can be added for heavy pages if needed.

---

## 9. External Interfaces

- **Supabase:** When URL and anon key are set, the app uses Supabase for persistence of all entities. Reads and writes go through `storage.ts`, which delegates to `supabase-storage.ts`. Column names are snake_case in Supabase; app uses camelCase in code. Schema must match (see section 5.4 and SQL scripts).
- **IndexedDB:** Used as primary store when Supabase is not configured; otherwise Supabase is source of truth. All main entities are in object stores keyed by id (or key for settings).
- **Browser:** localStorage for session; BroadcastChannel for cross-tab “user deleted”; CustomEvent for “userUpdated”.

---

## 10. Document References

| Document | Purpose |
|----------|---------|
| **README.md** | Project overview and high-level setup. |
| **START_HERE.md** | Short Supabase setup and env steps. |
| **supabase-setup.sql** / **supabase-setup-complete.sql** | Base Supabase schema. |
| **supabase-add-teams.sql** | Teams, users.employee_id, users.must_change_password, employees.team_id, employees.reports_to. |
| **supabase-appraisal-assignments.sql** | appraisal_assignments table. |
| **supabase-hr-hierarchy.sql** | Allow hierarchy 'hr' and relationship_type 'hr-to-all' where applicable. |
| **supabase-settings-hr-columns.sql** | settings.hr_score_weight, require_hr_for_ranking. |
| **VERCEL_SETUP.md**, **SUPABASE_SETUP.md** | Deployment and integration. |
| **DATA_MIGRATION_GUIDE.md**, **UPDATE_STORAGE.md** | Data and storage updates. |

---

*This SRS describes the Performance Appraisal System as implemented, including authentication, session invalidation on user delete, user–employee link/unlink, teams and department leaders (via employee.teamId), auto-assignment rules (Reports To, same-team, Leader→Member, Member→Leader, Leader→Leader, Exec→Leader, HR→All), assignments and Submission Tracker, dashboard pending/completed counts, employee My Performance with AI narrative, and optional Supabase backend with full schema alignment.*
