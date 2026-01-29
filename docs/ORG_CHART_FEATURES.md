# Organization Chart & Analytics

## Organization Chart (`/org-chart`)

- **Tree view**: Hierarchy-based tree (Chairman → Executives → Department Leaders → Members/HR). Zoom and pan with mouse/touch; use Reset view / +/- to control zoom.
- **By department**: View each team’s structure in separate sections.
- **Search**: Use “Find employee…” to highlight matching nodes (green ring). Matches by name or role.
- **Filters**: Open the Filters panel to include or exclude hierarchy levels (Chairman, Executive, Department Leader, Team Member, HR). “Department Leader” includes both legacy `leader` and `department-leader`.
- **Keyboard**: Focus a node and press Enter or Space to open the profile modal. Escape closes modals.
- **Accessibility**: Nodes have `aria-label` with name, role, and direct report count. Zoom and filter controls have descriptive labels.

## Organization Analytics (`/organization-analytics`) — Admin

- **Structure overview**: Total employees, counts by hierarchy (Chairman, Executives with Operational/Advisory split, Department Leaders, Members, HR), and department count.
- **Span of control**: Average, min, and max direct reports per leader/executive.
- **Reporting structure health**: Counts and lists for employees missing “Reports To”, departments without leaders, and employees not in any department.
- **Department comparison**: Table of each department with total headcount, leaders, and members.
- **Export CSV**: Download organization data (name, email, role, hierarchy, executive type, department, reports to) for HRIS or reporting.

## Hierarchy

- **Chairman / CEO**: Top level; no “Reports To”.
- **Executive**: C-Suite (e.g. CFO, CTO). Optional **Executive type**: Operational (manages department(s)) or Advisory (no direct department).
- **Department Leader**: Manages a team within a department. Same level as legacy “Leader”.
- **Team Member**: Individual contributor.
- **HR Personnel**: Company-wide HR; same level as member in the chart.

## Data

- Chart is built from **hierarchy only** (not “Reports To”) for the tree structure. “Reports To” is still used for reporting chain in profiles and for auto-assignment.
- Run `supabase-org-overhaul.sql` in Supabase to add `executive_type`, `updated_at`, and allow `department-leader` in the hierarchy check.
