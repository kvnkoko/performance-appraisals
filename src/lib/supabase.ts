import type { User } from '@/types';

// Lazy load Supabase to avoid build errors if package not installed
let supabaseClient: any = null;
let supabaseModule: any = null;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  try {
    if (!supabaseModule) {
      supabaseModule = await import('@supabase/supabase-js');
    }
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = supabaseModule.createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return supabaseClient;
    }
  } catch (error) {
    console.warn('Supabase package not available:', error);
  }
  
  return null;
}

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Database table names
export const TABLES = {
  USERS: 'users',
  SETTINGS: 'settings',
} as const;

// User management functions using Supabase
export async function getUsersFromSupabase(): Promise<User[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured, falling back to IndexedDB');
    return [];
  }

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return [];
    }
    
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users from Supabase:', error);
      return [];
    }

    // Transform Supabase data to User type
    return (data || []).map((user: any) => ({
      id: user.id,
      username: user.username,
      passwordHash: user.password_hash,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    }));
  } catch (error) {
    console.error('Error in getUsersFromSupabase:', error);
    return [];
  }
}

export async function getUserByUsernameFromSupabase(username: string): Promise<User | undefined> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured, falling back to IndexedDB');
    return undefined;
  }

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return undefined;
    }
    
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .ilike('username', username.trim().toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return undefined;
      }
      console.error('Error fetching user from Supabase:', error);
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
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at,
    };
  } catch (error) {
    console.error('Error in getUserByUsernameFromSupabase:', error);
    return undefined;
  }
}

export async function saveUserToSupabase(user: User): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured, cannot save user');
    throw new Error('Supabase not configured');
  }

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    
    const userData = {
      id: user.id,
      username: user.username.toLowerCase(),
      password_hash: user.passwordHash,
      name: user.name,
      email: user.email || null,
      role: user.role,
      active: user.active !== undefined ? user.active : true,
      created_at: user.createdAt || new Date().toISOString(),
      last_login_at: user.lastLoginAt || null,
    };

    const { error } = await supabase
      .from(TABLES.USERS)
      .upsert(userData, { onConflict: 'id' });

    if (error) {
      console.error('Error saving user to Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveUserToSupabase:', error);
    throw error;
  }
}

export async function deleteUserFromSupabase(id: string): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase not configured, cannot delete user');
    throw new Error('Supabase not configured');
  }

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }
    
    const { error } = await supabase
      .from(TABLES.USERS)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting user from Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteUserFromSupabase:', error);
    throw error;
  }
}

export async function updateUserLastLogin(id: string): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return; // Silently fail if Supabase not configured
  }

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return;
    }
    
    const { error } = await supabase
      .from(TABLES.USERS)
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn('Error updating last login:', error);
    }
  } catch (error) {
    console.warn('Error in updateUserLastLogin:', error);
  }
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}
