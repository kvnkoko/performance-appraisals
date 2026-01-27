// Extended Supabase storage for ALL data types
// This file extends supabase.ts with functions for templates, employees, appraisals, etc.

import type { 
  Template, 
  Employee, 
  Appraisal, 
  AppraisalLink, 
  CompanySettings, 
  PerformanceSummary, 
  ReviewPeriod,
  Team,
  User
} from '@/types';
import { isSupabaseConfigured, getSupabaseClient } from './supabase';

const TABLES = {
  TEMPLATES: 'templates',
  EMPLOYEES: 'employees',
  APPRAISALS: 'appraisals',
  APPRAISAL_LINKS: 'appraisal_links',
  SETTINGS: 'settings',
  REVIEW_PERIODS: 'review_periods',
  PERFORMANCE_SUMMARIES: 'performance_summaries',
};

// ============================================
// TEMPLATES
// ============================================
export async function getTemplatesFromSupabase(): Promise<Template[]> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, returning empty array');
    return [];
  }
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.log('Supabase client not available');
      return [];
    }
    
    console.log('Fetching templates from Supabase...');
    const { data, error } = await supabase
      .from(TABLES.TEMPLATES)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching templates from Supabase:', error);
      // If table doesn't exist, return empty array (user needs to run SQL script)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Templates table does not exist. Please run supabase-setup-complete.sql');
      }
      return [];
    }
    
    const templates = (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      subtitle: t.subtitle || undefined,
      type: t.type,
      categories: t.categories || [],
      questions: t.questions || undefined,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      version: t.version || 1,
    }));
    
    console.log(`Loaded ${templates.length} templates from Supabase`);
    return templates;
  } catch (error) {
    console.error('Error in getTemplatesFromSupabase:', error);
    return [];
  }
}

export async function getTemplateFromSupabase(id: string): Promise<Template | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from(TABLES.TEMPLATES)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      id: data.id,
      name: data.name,
      subtitle: data.subtitle,
      type: data.type,
      categories: data.categories || [],
      questions: data.questions || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      version: data.version || 1,
    };
  } catch (error) {
    console.error('Error in getTemplateFromSupabase:', error);
    return undefined;
  }
}

export async function saveTemplateToSupabase(template: Template): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    
    const templateData = {
      id: template.id,
      name: template.name,
      subtitle: template.subtitle || null,
      type: template.type,
      categories: template.categories || [],
      questions: template.questions || null,
      created_at: template.createdAt || new Date().toISOString(),
      updated_at: template.updatedAt || new Date().toISOString(),
      version: template.version || 1,
    };
    
    console.log('Saving template to Supabase:', templateData.id, templateData.name);
    
    const { data, error } = await supabase
      .from(TABLES.TEMPLATES)
      .upsert(templateData, { onConflict: 'id' });
    
    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }
    
    console.log('Template saved successfully to Supabase:', template.id);
  } catch (error) {
    console.error('Error in saveTemplateToSupabase:', error);
    throw error;
  }
}

export async function deleteTemplateFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.TEMPLATES)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteTemplateFromSupabase:', error);
    throw error;
  }
}

// ============================================
// EMPLOYEES
// ============================================
export async function getEmployeesFromSupabase(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from(TABLES.EMPLOYEES)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching employees from Supabase:', error);
      return [];
    }
    
    return (data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.role,
      hierarchy: e.hierarchy,
      teamId: e.team_id,
      reportsTo: e.reports_to,
      createdAt: e.created_at,
    }));
  } catch (error) {
    console.error('Error in getEmployeesFromSupabase:', error);
    return [];
  }
}

export async function getEmployeeFromSupabase(id: string): Promise<Employee | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from(TABLES.EMPLOYEES)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      hierarchy: data.hierarchy,
      teamId: data.team_id,
      reportsTo: data.reports_to,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error in getEmployeeFromSupabase:', error);
    return undefined;
  }
}

/** Update only team_id for an employee (assign/remove as department leader). Avoids full upsert 400s. */
export async function updateEmployeeTeamInSupabase(employeeId: string, teamId: string | null): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not available');

  const { error } = await supabase
    .from(TABLES.EMPLOYEES)
    .update({ team_id: teamId })
    .eq('id', employeeId);

  if (error) {
    console.error('Error in updateEmployeeTeamInSupabase:', error.message, error.details);
    throw error;
  }
}

export async function saveEmployeeToSupabase(employee: Employee): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');

    const payload = {
      id: employee.id,
      name: employee.name,
      email: employee.email ?? null,
      role: employee.role,
      hierarchy: employee.hierarchy,
      team_id: employee.teamId ?? null,
      reports_to: (employee as { reportsTo?: string }).reportsTo ?? null,
      created_at: employee.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from(TABLES.EMPLOYEES)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error in saveEmployeeToSupabase:', error.message, error.details, payload);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveEmployeeToSupabase:', error);
    throw error;
  }
}

export async function deleteEmployeeFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.EMPLOYEES)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteEmployeeFromSupabase:', error);
    throw error;
  }
}

// ============================================
// APPRAISALS
// ============================================
export async function getAppraisalsFromSupabase(): Promise<Appraisal[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from(TABLES.APPRAISALS)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching appraisals from Supabase:', error);
      return [];
    }
    
    return (data || []).map((a: any) => ({
      id: a.id,
      templateId: a.template_id,
      employeeId: a.employee_id,
      appraiserId: a.appraiser_id,
      reviewPeriodId: a.review_period_id,
      reviewPeriodName: a.review_period_name,
      responses: a.responses || [],
      score: a.score,
      maxScore: a.max_score,
      completedAt: a.completed_at,
      createdAt: a.created_at,
    }));
  } catch (error) {
    console.error('Error in getAppraisalsFromSupabase:', error);
    return [];
  }
}

export async function getAppraisalFromSupabase(id: string): Promise<Appraisal | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from(TABLES.APPRAISALS)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      id: data.id,
      templateId: data.template_id,
      employeeId: data.employee_id,
      appraiserId: data.appraiser_id,
      reviewPeriodId: data.review_period_id,
      reviewPeriodName: data.review_period_name,
      responses: data.responses || [],
      score: data.score,
      maxScore: data.max_score,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error in getAppraisalFromSupabase:', error);
    return undefined;
  }
}

export async function saveAppraisalToSupabase(appraisal: Appraisal): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.APPRAISALS)
      .upsert({
        id: appraisal.id,
        template_id: appraisal.templateId,
        employee_id: appraisal.employeeId,
        appraiser_id: appraisal.appraiserId,
        review_period_id: appraisal.reviewPeriodId,
        review_period_name: appraisal.reviewPeriodName,
        responses: appraisal.responses,
        score: appraisal.score,
        max_score: appraisal.maxScore,
        completed_at: appraisal.completedAt,
        created_at: appraisal.createdAt,
      }, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in saveAppraisalToSupabase:', error);
    throw error;
  }
}

export async function deleteAppraisalFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.APPRAISALS)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteAppraisalFromSupabase:', error);
    throw error;
  }
}

// ============================================
// APPRAISAL LINKS
// ============================================
export async function getLinksFromSupabase(): Promise<AppraisalLink[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from(TABLES.APPRAISAL_LINKS)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching links from Supabase:', error);
      return [];
    }
    
    return (data || []).map((l: any) => ({
      id: l.id,
      employeeId: l.employee_id,
      appraiserId: l.appraiser_id,
      templateId: l.template_id,
      reviewPeriodId: l.review_period_id,
      reviewPeriodName: l.review_period_name,
      token: l.token,
      expiresAt: l.expires_at,
      used: l.used,
      createdAt: l.created_at,
    }));
  } catch (error) {
    console.error('Error in getLinksFromSupabase:', error);
    return [];
  }
}

export async function getLinkByTokenFromSupabase(token: string): Promise<AppraisalLink | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from(TABLES.APPRAISAL_LINKS)
      .select('*')
      .eq('token', token)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      id: data.id,
      employeeId: data.employee_id,
      appraiserId: data.appraiser_id,
      templateId: data.template_id,
      reviewPeriodId: data.review_period_id,
      reviewPeriodName: data.review_period_name,
      token: data.token,
      expiresAt: data.expires_at,
      used: data.used,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error in getLinkByTokenFromSupabase:', error);
    return undefined;
  }
}

export async function saveLinkToSupabase(link: AppraisalLink): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.APPRAISAL_LINKS)
      .upsert({
        id: link.id,
        employee_id: link.employeeId,
        appraiser_id: link.appraiserId,
        template_id: link.templateId,
        review_period_id: link.reviewPeriodId || null,
        review_period_name: link.reviewPeriodName || null,
        token: link.token,
        expires_at: link.expiresAt,
        used: link.used,
        created_at: link.createdAt,
      }, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in saveLinkToSupabase:', error);
    throw error;
  }
}

export async function deleteLinkFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.APPRAISAL_LINKS)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteLinkFromSupabase:', error);
    throw error;
  }
}

// ============================================
// SETTINGS
// ============================================
export async function getSettingsFromSupabase(): Promise<CompanySettings | null> {
  if (!isSupabaseConfigured()) return null;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from(TABLES.SETTINGS)
      .select('*')
      .eq('key', 'company')
      .single();
    
    if (error || !data) return null;
    
    return {
      name: data.name,
      logo: data.logo || undefined,
      adminPin: data.admin_pin,
      accentColor: data.accent_color,
      theme: data.theme,
    };
  } catch (error) {
    console.error('Error in getSettingsFromSupabase:', error);
    return null;
  }
}

export async function saveSettingsToSupabase(settings: CompanySettings): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.SETTINGS)
      .upsert({
        key: 'company',
        name: settings.name,
        logo: settings.logo || null,
        admin_pin: settings.adminPin,
        accent_color: settings.accentColor,
        theme: settings.theme,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in saveSettingsToSupabase:', error);
    throw error;
  }
}

// ============================================
// REVIEW PERIODS
// ============================================
export async function getReviewPeriodsFromSupabase(): Promise<ReviewPeriod[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from(TABLES.REVIEW_PERIODS)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching review periods from Supabase:', error);
      return [];
    }
    
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      year: p.year,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status,
      description: p.description,
      createdAt: p.created_at,
    }));
  } catch (error) {
    console.error('Error in getReviewPeriodsFromSupabase:', error);
    return [];
  }
}

export async function getReviewPeriodFromSupabase(id: string): Promise<ReviewPeriod | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from(TABLES.REVIEW_PERIODS)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      year: data.year,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      description: data.description,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error in getReviewPeriodFromSupabase:', error);
    return undefined;
  }
}

export async function saveReviewPeriodToSupabase(period: ReviewPeriod): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.REVIEW_PERIODS)
      .upsert({
        id: period.id,
        name: period.name,
        type: period.type,
        year: period.year,
        start_date: period.startDate,
        end_date: period.endDate,
        status: period.status,
        description: period.description || null,
        created_at: period.createdAt,
      }, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in saveReviewPeriodToSupabase:', error);
    throw error;
  }
}

export async function deleteReviewPeriodFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.REVIEW_PERIODS)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteReviewPeriodFromSupabase:', error);
    throw error;
  }
}

// ============================================
// PERFORMANCE SUMMARIES
// ============================================
export async function getSummaryFromSupabase(employeeId: string): Promise<PerformanceSummary | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from(TABLES.PERFORMANCE_SUMMARIES)
      .select('*')
      .eq('employee_id', employeeId)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      employeeId: data.employee_id,
      period: data.period,
      totalScore: data.total_score,
      maxScore: data.max_score,
      percentage: data.percentage,
      strengths: data.insights?.strengths || [],
      improvements: data.insights?.improvements || [],
      narrative: data.summary_text,
      breakdown: data.insights?.breakdown || [],
    };
  } catch (error) {
    console.error('Error in getSummaryFromSupabase:', error);
    return undefined;
  }
}

export async function saveSummaryToSupabase(summary: PerformanceSummary): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from(TABLES.PERFORMANCE_SUMMARIES)
      .upsert({
        employee_id: summary.employeeId,
        period: summary.period,
        total_score: summary.totalScore,
        max_score: summary.maxScore,
        percentage: summary.percentage,
        summary_text: summary.narrative,
        insights: {
          strengths: summary.strengths,
          improvements: summary.improvements,
          breakdown: summary.breakdown,
        },
        generated_at: new Date().toISOString(),
      }, { onConflict: 'employee_id' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in saveSummaryToSupabase:', error);
    throw error;
  }
}

// ============================================
// TEAMS
// ============================================
export async function getTeamsFromSupabase(): Promise<Team[]> {
  if (!isSupabaseConfigured()) return [];
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching teams from Supabase:', error);
      return [];
    }
    
    return (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      createdAt: t.created_at,
    }));
  } catch (error) {
    console.error('Error in getTeamsFromSupabase:', error);
    return [];
  }
}

export async function getTeamFromSupabase(id: string): Promise<Team | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error in getTeamFromSupabase:', error);
    return undefined;
  }
}

export async function saveTeamToSupabase(team: Team): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('teams')
      .upsert({
        id: team.id,
        name: team.name,
        description: team.description || null,
        created_at: team.createdAt,
      }, { onConflict: 'id' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in saveTeamToSupabase:', error);
    throw error;
  }
}

export async function deleteTeamFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteTeamFromSupabase:', error);
    throw error;
  }
}

// Get user by employee ID
export async function getUserByEmployeeIdFromSupabase(employeeId: string): Promise<User | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return undefined;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle(); // Use maybeSingle instead of single to handle 0 results gracefully
    
    if (error) {
      // If error is "PGRST116" (no rows returned), that's fine - just return undefined
      if (error.code !== 'PGRST116') {
        console.error('Error in getUserByEmployeeIdFromSupabase:', error);
      }
      return undefined;
    }
    
    if (!data) return undefined;
    
    return {
      id: data.id,
      username: data.username,
      passwordHash: data.password_hash,
      name: data.name,
      email: data.email,
      role: data.role,
      active: data.active,
      employeeId: data.employee_id,
      mustChangePassword: data.must_change_password,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at,
    };
  } catch (error) {
    console.error('Error in getUserByEmployeeIdFromSupabase:', error);
    return undefined;
  }
}
