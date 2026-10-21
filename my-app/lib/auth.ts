import { getSupabaseBrowserClient } from './client';

// Types
// admin            - system administrator: creates college administrator accounts
// college_admin    - one per college: faculty, availability, classrooms, departments + their admins
// department_admin - one per department: subjects, sections, timetable generation
// faculty          - views their own timetable
export type UserRole = 'admin' | 'college_admin' | 'department_admin' | 'faculty';

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

/** A college administrator (stored in timetable_administrators; the row id is the college id) */
export interface CollegeAdmin {
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

/** @deprecated kept for older imports; a timetable administrator is now a college administrator */
export type TimetableAdministrator = CollegeAdmin;

export interface DepartmentAdmin {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  department_id: string;
  college_id: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  departments?: { name: string; code: string } | null;
  timetable_administrators?: { institution_name: string | null } | null;
}

export interface FacultyUser {
  id: string;
  code: string;
  name: string;
}

export type AuthUser = AdminUser | CollegeAdmin | DepartmentAdmin | FacultyUser;

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
  user?: AuthUser;
  session?: AuthSession;
  role?: UserRole;
}

// Admin Login
export async function loginAdmin(username: string, password: string): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/login-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();
    return result;
  } catch (err) {
    console.error('Admin login error:', err);
    return { success: false, message: 'An error occurred during login' };
  }
}

async function postLogin(path: string, body: Record<string, string>, label: string): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return result;
  } catch (err) {
    console.error(`${label} login error:`, err);
    return { success: false, message: 'An error occurred during login' };
  }
}

// College Administrator Login
export async function loginCollegeAdmin(username: string, password: string): Promise<AuthResult> {
  return postLogin('/api/auth/login-college-admin', { username, password }, 'College admin');
}

// Department Administrator Login
export async function loginDepartmentAdmin(username: string, password: string): Promise<AuthResult> {
  return postLogin('/api/auth/login-department-admin', { username, password }, 'Department admin');
}

// Faculty Login (code = identifier, phone = credential)
export async function loginFaculty(code: string, phone: string): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/login-faculty', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, phone }),
    });

    const result = await response.json();
    return result;
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
    } else if (session.user_type === 'college_admin') {
      const { data } = await supabase
        .from('timetable_administrators')
        .select('id, username, name, email, phone, institution_name, is_active')
        .eq('id', session.user_id)
        .single();
      user = data;
    } else if (session.user_type === 'department_admin') {
      const { data } = await supabase
        .from('department_admins')
        .select('id, username, name, email, phone, department_id, college_id, is_active, departments(name, code), timetable_administrators(institution_name)')
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

// Create College Administrator (System admin only)
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
): Promise<{ success: boolean; message: string; data?: CollegeAdmin }> {
  try {
    // Call server-side API to create admin and send email
    const response = await fetch('/api/timetable-administrator/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        message: result.message || 'Failed to create administrator' 
      };
    }

    return {
      success: true,
      message: result.message,
      data: result.data as CollegeAdmin
    };
  } catch (err) {
    console.error('Create timetable admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

// Get all College Administrators (System admin only)
export async function getTimetableAdministrators(): Promise<CollegeAdmin[]> {
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

// Update College Administrator
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
  try {
    // Call server-side API to update admin and send email notification
    const response = await fetch('/api/timetable-administrator/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data })
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        message: result.message || 'Failed to update administrator' 
      };
    }

    return {
      success: true,
      message: result.message || 'Updated successfully'
    };
  } catch (err) {
    console.error('Update timetable admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

// Delete College Administrator (cascades to the college's data)
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

// ------------------------------------------------------------------
// Department administrators (managed by the college administrator)
// ------------------------------------------------------------------

export async function getDepartmentAdmins(collegeId: string): Promise<DepartmentAdmin[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('department_admins')
    .select('id, username, name, email, phone, department_id, college_id, is_active, last_login, created_at, departments(name, code)')
    .eq('college_id', collegeId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Get department admins error:', error);
    return [];
  }
  return data || [];
}

export async function saveDepartmentAdmin(
  data: {
    id?: string;
    username?: string;
    password?: string;
    name: string;
    email?: string;
    phone?: string;
    department_id?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/department-admin', {
      method: data.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return { success: response.ok && result.success, message: result.message || 'Request failed' };
  } catch (err) {
    console.error('Save department admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

export async function deleteDepartmentAdmin(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`/api/department-admin?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json();
    return { success: response.ok && result.success, message: result.message || 'Request failed' };
  } catch (err) {
    console.error('Delete department admin error:', err);
    return { success: false, message: 'An error occurred' };
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** College and department the signed-in user acts for */
export function getUserScope(user: AuthUser | null, role: UserRole | null): { collegeId: string | null; departmentId: string | null } {
  if (!user || !role) return { collegeId: null, departmentId: null };
  if (role === 'college_admin') return { collegeId: user.id, departmentId: null };
  if (role === 'department_admin') {
    const dept = user as DepartmentAdmin;
    return { collegeId: dept.college_id, departmentId: dept.department_id };
  }
  return { collegeId: null, departmentId: null };
}

/** Session token for calls that the edge functions validate server-side */
export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('timetable_session_token');
  } catch {
    return null;
  }
}

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/dashboard/admin',
  college_admin: '/college',
  department_admin: '/department',
  faculty: '/faculty',
};

export const ROLE_LOGIN: Record<UserRole, string> = {
  admin: '/login/admin',
  college_admin: '/login/college-admin',
  department_admin: '/login/department-admin',
  faculty: '/login/faculty',
};
