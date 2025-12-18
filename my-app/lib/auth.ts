import { getSupabaseBrowserClient } from './client';

// Types
export type UserRole = 'admin' | 'timetable_admin' | 'faculty';

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface TimetableAdministrator {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  institution_name: string | null;
  is_active: boolean;
  created_by: string | null;
  last_login: string | null;
  created_at: string;
}

export interface AuthSession {
  id: string;
  user_id: string;
  user_type: UserRole;
  session_token: string;
  expires_at: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  user?: AdminUser | TimetableAdministrator | { id: string; code: string; name: string };
  session?: AuthSession;
  role?: UserRole;
}

// Generate session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Admin Login
export async function loginAdmin(username: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    // Verify admin credentials
    const { data: admin, error } = await supabase
      .rpc('verify_admin_login', { 
        p_username: username, 
        p_password: password 
      });
    
    if (error || !admin || admin.length === 0) {
      // Fallback: direct query with password verification
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, username, name, email, is_active, password_hash')
        .eq('username', username)
        .eq('is_active', true)
        .single();
      
      if (adminError || !adminData) {
        return { success: false, message: 'Invalid username or password' };
      }
      
      // Verify password using RPC
      const { data: isValid } = await supabase
        .rpc('verify_password', { 
          stored_hash: adminData.password_hash, 
          input_password: password 
        });
      
      if (!isValid) {
        return { success: false, message: 'Invalid username or password' };
      }
      
      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: adminData.id,
          user_type: 'admin',
          session_token: sessionToken,
          expires_at: expiresAt
        })
        .select()
        .single();
      
      if (sessionError) {
        return { success: false, message: 'Failed to create session' };
      }
      
      // Update last login
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', adminData.id);
      
      const { password_hash, ...safeAdmin } = adminData;
      
      return {
        success: true,
        message: 'Login successful',
        user: safeAdmin as AdminUser,
        session,
        role: 'admin'
      };
    }
    
    return { success: false, message: 'Invalid username or password' };
  } catch (err) {
    console.error('Admin login error:', err);
    return { success: false, message: 'An error occurred during login' };
  }
}

// Timetable Administrator Login
export async function loginTimetableAdmin(username: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const { data: adminData, error: adminError } = await supabase
      .from('timetable_administrators')
      .select('id, username, name, email, phone, institution_name, is_active, password_hash')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (adminError || !adminData) {
      return { success: false, message: 'Invalid username or password' };
    }
    
    // Verify password
    const { data: isValid } = await supabase
      .rpc('verify_password', { 
        stored_hash: adminData.password_hash, 
        input_password: password 
      });
    
    if (!isValid) {
      return { success: false, message: 'Invalid username or password' };
    }
    
    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: adminData.id,
        user_type: 'timetable_admin',
        session_token: sessionToken,
        expires_at: expiresAt
      })
      .select()
      .single();
    
    if (sessionError) {
      return { success: false, message: 'Failed to create session' };
    }
    
    // Update last login
    await supabase
      .from('timetable_administrators')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminData.id);
    
    const { password_hash, ...safeAdmin } = adminData;
    
    return {
      success: true,
      message: 'Login successful',
      user: safeAdmin as TimetableAdministrator,
      session,
      role: 'timetable_admin'
    };
  } catch (err) {
    console.error('Timetable admin login error:', err);
    return { success: false, message: 'An error occurred during login' };
  }
}

// Faculty Login (username = code, password = phone)
export async function loginFaculty(code: string, phone: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const { data: faculty, error } = await supabase
      .from('faculty')
      .select('id, code, name, phone, email, is_active')
      .eq('code', code.toUpperCase())
      .eq('phone', phone)
      .eq('is_active', true)
      .single();
    
    if (error || !faculty) {
      return { success: false, message: 'Invalid faculty code or phone number' };
    }
    
    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: faculty.id,
        user_type: 'faculty',
        session_token: sessionToken,
        expires_at: expiresAt
      })
      .select()
      .single();
    
    if (sessionError) {
      return { success: false, message: 'Failed to create session' };
    }
    
    return {
      success: true,
      message: 'Login successful',
      user: { id: faculty.id, code: faculty.code, name: faculty.name },
      session,
      role: 'faculty'
    };
  } catch (err) {
    console.error('Faculty login error:', err);
    return { success: false, message: 'An error occurred during login' };
  }
}

// Validate session
export async function validateSession(sessionToken: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error || !session) {
      return { success: false, message: 'Invalid or expired session' };
    }
    
    // Get user data based on type
    let user;
    if (session.user_type === 'admin') {
      const { data } = await supabase
        .from('admin_users')
        .select('id, username, name, email, is_active')
        .eq('id', session.user_id)
        .single();
      user = data;
    } else if (session.user_type === 'timetable_admin') {
      const { data } = await supabase
        .from('timetable_administrators')
        .select('id, username, name, email, phone, institution_name, is_active')
        .eq('id', session.user_id)
        .single();
      user = data;
    } else if (session.user_type === 'faculty') {
      const { data } = await supabase
        .from('faculty')
        .select('id, code, name')
        .eq('id', session.user_id)
        .single();
      user = data;
    }
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    return {
      success: true,
      message: 'Session valid',
      user,
      session,
      role: session.user_type as UserRole
    };
  } catch (err) {
    console.error('Session validation error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

// Logout
export async function logout(sessionToken: string): Promise<{ success: boolean }> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    await supabase
      .from('user_sessions')
      .delete()
      .eq('session_token', sessionToken);
    
    return { success: true };
  } catch (err) {
    console.error('Logout error:', err);
    return { success: false };
  }
}

// Create Timetable Administrator (Admin only)
export async function createTimetableAdministrator(
  adminId: string,
  data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    phone?: string;
    institution_name?: string;
  }
): Promise<{ success: boolean; message: string; data?: TimetableAdministrator }> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    // Hash password
    const { data: hashedPassword } = await supabase
      .rpc('hash_password', { password: data.password });
    
    if (!hashedPassword) {
      return { success: false, message: 'Failed to hash password' };
    }
    
    const { data: newAdmin, error } = await supabase
      .from('timetable_administrators')
      .insert({
        username: data.username,
        password_hash: hashedPassword,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        institution_name: data.institution_name || null,
        created_by: adminId
      })
      .select('id, username, name, email, phone, institution_name, is_active, created_by, created_at')
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, message: 'Username already exists' };
      }
      return { success: false, message: error.message };
    }
    
    return {
      success: true,
      message: 'Timetable Administrator created successfully',
      data: newAdmin as TimetableAdministrator
    };
  } catch (err) {
    console.error('Create timetable admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

// Get all Timetable Administrators (Admin only)
export async function getTimetableAdministrators(): Promise<TimetableAdministrator[]> {
  const supabase = getSupabaseBrowserClient();
  
  const { data, error } = await supabase
    .from('timetable_administrators')
    .select('id, username, name, email, phone, institution_name, is_active, created_by, last_login, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Get timetable admins error:', error);
    return [];
  }
  
  return data || [];
}

// Update Timetable Administrator
export async function updateTimetableAdministrator(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    institution_name?: string;
    is_active?: boolean;
    password?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    
    if (data.name) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.institution_name !== undefined) updateData.institution_name = data.institution_name;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    
    if (data.password) {
      const { data: hashedPassword } = await supabase
        .rpc('hash_password', { password: data.password });
      if (hashedPassword) {
        updateData.password_hash = hashedPassword;
      }
    }
    
    const { error } = await supabase
      .from('timetable_administrators')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      return { success: false, message: error.message };
    }
    
    return { success: true, message: 'Updated successfully' };
  } catch (err) {
    console.error('Update timetable admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

// Delete Timetable Administrator
export async function deleteTimetableAdministrator(id: string): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const { error } = await supabase
      .from('timetable_administrators')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, message: error.message };
    }
    
    return { success: true, message: 'Deleted successfully' };
  } catch (err) {
    console.error('Delete timetable admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}
