# Software Requirements Specification (SRS)
## Performance Appraisal System

**Version:** 1.0  
**Status:** Finalized  
**Last updated:** January 2026

---

## 1. Purpose and Scope

### 1.1 Purpose
This document describes the functional and non-functional requirements of the **Performance Appraisal System**: a web application for defining appraisal templates, managing employees and org structure, generating appraisal assignments (manual or from org structure), and collecting and reviewing performance feedback. The system supports both administrators and staff (employees) with role-based views and workflows.

### 1.2 Scope
- **In scope:** Authentication (username/password and optional admin PIN), user and employee management, teams and department heads (executives/leaders), review periods, appraisal templates, manual and auto-generated appraisal links/assignments, completion of appraisal forms, reviews/analytics, historical reviews, employee self-service (My Dashboard, My Appraisals, My Performance with AI narrative summary), settings (company name, theme, accent, PIN), and deployment (Vercel with optional Supabase backend).
- **Out of scope:** Native mobile apps, SSO/OAuth, payroll integration, and advanced analytics beyond the defined reviews and historical views.

---

## 2. Actors

| Actor | Description | Main capabilities |
|-------|-------------|-------------------|
| **Administrator** | User with role `admin`. Full access to all admin pages. | Manage templates, employees, teams, users, appraisal links, periods, reviews, settings; view dashboard. |
| **Staff (Employee)** | User with role `staff`, optionally linked to an Employee record. | Access employee portal: My Dashboard, My Appraisals, My Performance; limited to own data and assigned appraisals. |

Additional logical roles used in appraisal logic (stored on **Employee**, not User):
- **Executive** – hierarchy `executive`; can lead a department (team) and appraise leaders in that department.
- **Leader** – hierarchy `leader`; leads a department; appraises members and is appraised by members and executives.
- **Member** – hierarchy `member`; has a manager (Reports To or same-team leader/executive) and may give upward feedback.

---

## 3. Functional Requirements by Module

### 3.1 Authentication (Auth)

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-AUTH-1 | Support login by **username + password**. | Passwords hashed (bcrypt-style). Session stored in `localStorage` (authenticated, userId, username, userName, userEmail, userRole, employeeId). |
| FR-AUTH-2 | Support optional **admin PIN** login. | PIN from Company Settings; grants admin role without a user record. |
| FR-AUTH-3 | Enforce **first-login password change** when `mustChangePassword` is set. | User must set a new password before proceeding. |
| FR-AUTH-4 | Reject login for **inactive** users (`active === false`). | Toast: "Account disabled". |
| FR-AUTH-5 | Redirect **admin** to `/dashboard`, **staff** to `/my-dashboard` after login. | |

### 3.2 Session and User Context

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-SES-1 | On each load, **validate current user** (e.g. via `getUser(userId)`). | If user was deleted (not found), clear all session keys and treat as logged out → redirect to `/auth`. |
| FR-SES-2 | When a user is **deleted**, broadcast `userDeleted` on a shared channel. | Other tabs listening with the same userId clear session and log out. |
| FR-SES-3 | **Logout** clears: `authenticated`, `userId`, `username`, `userName`, `userEmail`, `userRole`, `employeeId`. | Used from Sidebar and Settings. |

### 3.3 Dashboard (Admin Overview)

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-DASH-1 | Show **summary counts**: Templates, Employees, Pending (from assignments with status pending/in-progress), Completed (appraisals with completedAt), Active Links. | |
| FR-DASH-2 | Show **Average Scores by Template** (bar chart). | Only templates with at least one completed appraisal. |
| FR-DASH-3 | Show **Recent Completions** list. | Latest completed appraisals with employee name, date, score. |
| FR-DASH-4 | Provide **Quick Actions**: Create Template, Generate Links, View Reviews. | Links to respective pages. |

### 3.4 Templates

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-TMPL-1 | CRUD for **appraisal templates**. | Name, subtitle, type (e.g. leaders-to-members, members-to-leaders), categories and items (rating, text, multiple-choice), weights, required flag. |
| FR-TMPL-2 | Template **type** aligns with relationship types used in auto-assignment. | e.g. Leader→Member, Member→Leader, Leader→Leader, Executive→Leader. |

### 3.5 Employees

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-EMP-1 | CRUD for **employees**. | Name, email, role (title), hierarchy (executive | leader | member), teamId, reportsTo. |
| FR-EMP-2 | **Team** and **Reports To** editable. | Team = department; Reports To = direct manager (Leader or Executive). Used for auto-assignment. |
| FR-EMP-3 | **Executives** may be assigned as **department heads** for a team. | Via Teams (edit team → Department Leaders) or via Employee (e.g. “team this leader manages”). Executives who lead a department are treated like leaders for that department in auto-assignment. |
| FR-EMP-4 | **Link user account** to employee (and unlink). | From User dialog: “Link Employee”; from Employee dialog: “Link User” / “Unlink User”. Persisted as `user.employeeId`. |
| FR-EMP-5 | Option to **auto-create login account** when adding an employee. | Creates user, links by employeeId, shows credentials once. |

### 3.6 Teams

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-TEAM-1 | CRUD for **teams**. | Name, description. |
| FR-TEAM-2 | **Department Leaders**: assign Employees (Executives or Leaders) as leaders of the team. | Stored per team (e.g. leader IDs). Used in auto-assignment: Exec→Leader uses “executives who lead this department” and “leaders in this department”. |
| FR-TEAM-3 | Show **members** of the team (employees with `teamId === team.id`). | |

### 3.7 Users

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-USR-1 | CRUD for **users**. | Username (unique), name, email, role (admin | staff), active, password (optional on edit). |
| FR-USR-2 | **Link / Unlink** user to an employee. | Unlink clears `user.employeeId`; UI refreshes so “No employee linked” is shown; parent list and edit state stay in sync (optimistic update + refresh from source of truth). |
| FR-USR-3 | **Delete user.** | Removes user from storage/Supabase; they cannot log in; any existing session is invalidated (see FR-SES-1, FR-SES-2). |

### 3.8 Appraisal Links / Auto-Assignment

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-LINK-1 | **Manual links**: create individual appraisal links (appraiser, employee, template, period, optional due date). | Generates a tokenized link used once to open the form. |
| FR-LINK-2 | **Auto-generate** from org structure. | Select period; optionally include Leader→Leader (peer) and Executive→Leader; live preview of pair counts. |
| FR-LINK-3 | **Pairing rules:** | Leader→Member / Member→Leader: use Reports To first; if missing, use same-team leader/executive. Leader→Leader: peer among department heads (same-team and cross-department). Executive→Leader: each executive who leads a department appraises each leader in that department. |
| FR-LINK-4 | **Warnings** when members have no Reports To/team or managers have no direct reports. | Shown in UI to guide data completion. |
| FR-LINK-5 | Generated links create **assignments** (and optional link records). | Assignments drive “Pending” on dashboard and My Appraisals / My Dashboard. |

### 3.9 Review Periods

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-PER-1 | CRUD for **review periods**. | Name, type (Q1–Q4, H1, H2, Annual, Custom), year, start/end dates, status (planning | active | completed | archived). |

### 3.10 Reviews (Analytics)

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-REV-1 | **Aggregate scores** by period and optional employee filter. | |
| FR-REV-2 | **Narrative / AI summary** per employee and period. | Generated from completed appraisals; shown in admin Reviews and (for own data) in employee My Performance. |

### 3.11 Historical Reviews

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-HIST-1 | View **past review data** (completed appraisals, scores, summaries). | Filter by period, employee, etc., as implemented. |

### 3.12 Settings

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-SET-1 | **Company**: name, logo (if supported), admin PIN. | |
| FR-SET-2 | **Theme**: light / dark / system. | |
| FR-SET-3 | **Accent color** for UI. | Persisted and applied globally. |
| FR-SET-4 | **Export / Import** of data (and Supabase sync if configured). | As implemented. |
| FR-SET-5 | **Sign out** clears session and redirects to `/auth`. | Uses shared logout that clears all session keys including employeeId. |

### 3.13 Employee Portal – My Dashboard

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-MD-1 | Show **pending** and **completed** counts for the current user (from assignments and completed appraisals). | |
| FR-MD-2 | List **active review periods** and **actionable** items (e.g. “Complete appraisal” links). | |

### 3.14 Employee Portal – My Appraisals

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-MA-1 | List **appraisals** the user must complete (assignments) and **completed** appraisals. | |
| FR-MA-2 | Open **appraisal form** by assignment or by tokenized link. | |

### 3.15 Employee Portal – My Performance

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-MP-1 | **Aggregated performance** for the logged-in employee: scores, strengths, areas for growth, breakdown by category. | Based on completed appraisals for that employee in the selected period. |
| FR-MP-2 | **Narrative / AI summary** of strengths and weaknesses for the selected period. | Shown in a dedicated card; same narrative logic as in admin Reviews where applicable. |

---

## 4. Data Model (Summary)

- **User**: id, username, passwordHash, name, email, role, active, employeeId?, mustChangePassword?, createdAt, lastLoginAt.
- **Employee**: id, name, email?, role, hierarchy (executive|leader|member), teamId?, reportsTo?, createdAt.
- **Team**: id, name, description?, createdAt; plus stored department leader IDs.
- **ReviewPeriod**: id, name, type, year, startDate, endDate, status, description?, createdAt.
- **Template**: id, name, subtitle?, type, categories (with items: text, type, weight, required, options?), createdAt, updatedAt, version.
- **Appraisal**: id, templateId, employeeId, appraiserId, reviewPeriodId, reviewPeriodName, responses, score, maxScore, completedAt?, createdAt.
- **AppraisalLink** / **AppraisalAssignment**: identity of appraiser, employee, template, period, token (if link), status, assignmentType (auto|manual), dueDate?, etc.
- **CompanySettings**: name, logo?, adminPin, accentColor, theme.
- **PerformanceSummary**: employeeId, period, totalScore, maxScore, percentage, strengths, improvements, narrative, breakdown.

Persisted in **IndexedDB** (local). When **Supabase** is configured, templates, employees, teams, users, review periods, appraisals, links, assignments, and settings sync to Supabase; Supabase is the source of truth for reads in that mode. Schema for Supabase must include columns used by the app (e.g. `users.employee_id`, `employees.reports_to`, `employees.team_id`); see `supabase-add-teams.sql` and related docs.

---

## 5. Key Workflows

1. **Login** → Validate credentials/PIN → Set session in localStorage → Redirect by role.  
2. **Session validation** → On load, `getUser(userId)`; if null, clear session and redirect to /auth.  
3. **Delete user** → Remove from storage/Supabase; broadcast `userDeleted`; other tabs with that userId clear session.  
4. **Unlink user–employee** → Set `user.employeeId = undefined`, save, call `onSave(updatedUser)` so parent refreshes list and updates editing user; UI shows “No employee linked” without repopulating from stale data.  
5. **Auto-assignment** → Choose period and options → Preview pair counts (Leader→Member, Member→Leader, Leader→Leader, Exec→Leader) → Generate assignments (and links if applicable) from current employees, teams, and department heads.  
6. **Complete appraisal** → Open form by assignment or link → Submit responses → Record score and completedAt; assignment marked completed.  
7. **My Performance** → Select period → Load completed appraisals for current employee → Compute aggregates and call AI narrative summary → Display scores, strengths, improvements, narrative.  

---

## 6. Non-Functional Requirements

- **UI/UX**: Minimal, clear, “classy” layout; light and dark themes; accent color from settings; responsive layout (sidebar + main content).  
- **Accessibility**: Semantic structure, focus and contrast as implemented.  
- **Deployment**: Build via Vite; deploy to Vercel; optional Supabase backend via env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).  
- **Security**: Passwords hashed; session in localStorage; no credentials in logs. Debug logging in auth and sensitive paths has been removed or reduced.  

---

## 7. External Interfaces

- **Supabase**: When URL and anon key are set, the app uses Supabase for persistence of users, employees, teams, templates, review periods, appraisals, links, assignments, settings, and performance summaries. Tables and columns must match the app’s expectations (see schema scripts).  
- **IndexedDB**: Used as primary or fallback store (idb). All main entities are stored in object stores keyed by id.  
- **Browser**: LocalStorage for session; BroadcastChannel for cross-tab “user deleted” notifications.  

---

## 8. Document References

- **README.md** – Project overview and high-level setup.  
- **START_HERE.md** – Short Supabase setup and env steps.  
- **supabase-add-teams.sql** – Schema changes for teams, `users.employee_id`, `employees.team_id`, `employees.reports_to`, etc.  
- **supabase-setup.sql** / **supabase-setup-complete.sql** – Base Supabase schema.  
- **VERCEL_SETUP.md**, **SUPABASE_SETUP.md**, etc. – Deployment and integration variants as needed.  

---

*This SRS reflects the system as implemented and finalized, including auth, session invalidation on user delete, user–employee link/unlink behavior, auto-assignment rules (Reports To + team + department heads), dashboard pending/completed counts from assignments and appraisals, and the employee My Performance narrative summary.*
