import apiClient from '../api';

// ============================================
// Types
// ============================================

// Shift Templates
export interface ShiftTemplate {
  id: string;
  name: string;
  shift_type: 'morning' | 'afternoon' | 'full_day' | 'custom';
  start_time: string;
  end_time: string;
  break_minutes: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ShiftTemplateCreate {
  name: string;
  shift_type: 'morning' | 'afternoon' | 'full_day' | 'custom';
  start_time: string;
  end_time: string;
  break_minutes?: number;
  description?: string;
}

// Schedules
export interface Schedule {
  id: string;
  employee_id: string;
  employee_name: string | null;
  shift_template_id: string | null;
  shift_template_name: string | null;
  schedule_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
}

export interface ScheduleCreate {
  employee_id: string;
  shift_template_id?: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

// Attendance
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string | null;
  record_date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  minutes_late: number;
  minutes_early_departure: number;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface AttendanceCreate {
  employee_id: string;
  record_date: string;
  status: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

export interface DailyAttendanceSummary {
  date: string;
  total_employees: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  not_logged: number;
}

// Absences
export type AbsenceType =
  | 'absence_justified'
  | 'absence_unjustified'
  | 'tardiness'
  | 'early_departure'
  | 'vacation'
  | 'sick_leave';

export interface AbsenceRecord {
  id: string;
  employee_id: string;
  employee_name: string | null;
  attendance_record_id: string | null;
  absence_type: AbsenceType;
  absence_date: string;
  justification: string | null;
  evidence_url: string | null;
  is_deductible: boolean;
  deduction_amount: number;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AbsenceCreate {
  employee_id: string;
  absence_type: AbsenceType;
  absence_date: string;
  justification?: string;
  is_deductible?: boolean;
  deduction_amount?: number;
}

// Assignment Type
export type AssignmentType = 'position' | 'employee';

// Checklists
export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  description: string;
  sort_order: number;
  is_required: boolean;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  assignment_type: AssignmentType;
  position: string | null;
  employee_id: string | null;
  employee_name: string | null;
  description: string | null;
  is_active: boolean;
  items: ChecklistTemplateItem[];
  created_at: string;
}

export interface ChecklistTemplateCreate {
  name: string;
  assignment_type?: AssignmentType;
  position?: string;
  employee_id?: string;
  description?: string;
  items?: { description: string; sort_order?: number; is_required?: boolean }[];
}

export interface ChecklistTemplateUpdate {
  name?: string;
  assignment_type?: AssignmentType;
  position?: string;
  employee_id?: string;
  description?: string;
  is_active?: boolean;
}

export type ChecklistItemStatus = 'pending' | 'completed' | 'skipped';

export interface DailyChecklistItem {
  id: string;
  checklist_id: string;
  description: string;
  sort_order: number;
  is_required: boolean;
  status: ChecklistItemStatus;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

export interface DailyChecklist {
  id: string;
  employee_id: string;
  employee_name: string | null;
  template_id: string | null;
  checklist_date: string;
  total_items: number;
  completed_items: number;
  completion_rate: number;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  items: DailyChecklistItem[];
  created_at: string;
}

// Performance
export interface EmployeePerformanceMetrics {
  employee_id: string;
  employee_name: string;
  period_start: string;
  period_end: string;
  attendance_rate: number;
  punctuality_rate: number;
  checklist_completion_rate: number;
  total_sales_amount: number;
  total_sales_count: number;
  overall_score: number;
}

export interface PerformanceSummaryItem {
  employee_id: string;
  employee_name: string;
  position: string;
  attendance_rate: number;
  punctuality_rate: number;
  checklist_completion_rate: number;
  overall_score: number;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  employee_name: string | null;
  review_period: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  period_end: string;
  attendance_rate: number;
  punctuality_rate: number;
  checklist_completion_rate: number;
  total_sales_amount: number;
  total_sales_count: number;
  overall_score: number;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ============================================
// Labels & Colors
// ============================================

export const SHIFT_TYPE_LABELS: Record<string, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  full_day: 'Jornada Completa',
  custom: 'Personalizado',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Tarde',
  excused: 'Excusado',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  excused: 'bg-blue-100 text-blue-800',
};

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  absence_justified: 'Falta Justificada',
  absence_unjustified: 'Falta Injustificada',
  tardiness: 'Retardo',
  early_departure: 'Salida Temprana',
  vacation: 'Vacaciones',
  sick_leave: 'Incapacidad',
};

export const REVIEW_PERIOD_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
};

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  position: 'Por Cargo',
  employee: 'Individual',
};

export const ASSIGNMENT_TYPE_COLORS: Record<AssignmentType, string> = {
  position: 'bg-blue-100 text-blue-800',
  employee: 'bg-purple-100 text-purple-800',
};

// Position Responsibilities
export type ResponsibilityCategory = 'core' | 'administrative' | 'customer_service' | 'operational';

export interface PositionResponsibility {
  id: string;
  assignment_type: AssignmentType;
  position: string | null;
  employee_id: string | null;
  employee_name: string | null;
  title: string;
  description: string | null;
  category: ResponsibilityCategory;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PositionResponsibilityCreate {
  assignment_type?: AssignmentType;
  position?: string;
  employee_id?: string;
  title: string;
  description?: string;
  category: ResponsibilityCategory;
  sort_order?: number;
}

export interface PositionResponsibilityUpdate {
  assignment_type?: AssignmentType;
  position?: string;
  employee_id?: string;
  title?: string;
  description?: string;
  category?: ResponsibilityCategory;
  sort_order?: number;
  is_active?: boolean;
}

export const RESPONSIBILITY_CATEGORY_LABELS: Record<ResponsibilityCategory, string> = {
  core: 'Principal',
  administrative: 'Administrativo',
  customer_service: 'Atenci\u00f3n al Cliente',
  operational: 'Operativo',
};

export const RESPONSIBILITY_CATEGORY_COLORS: Record<ResponsibilityCategory, string> = {
  core: 'text-brand-700 bg-brand-50',
  administrative: 'text-purple-700 bg-purple-50',
  customer_service: 'text-green-700 bg-green-50',
  operational: 'text-orange-700 bg-orange-50',
};

// ============================================
// Service
// ============================================

const BASE = '/global/workforce';

const workforceService = {
  // --- Shift Templates ---
  getShiftTemplates: async (params?: { is_active?: boolean }): Promise<ShiftTemplate[]> => {
    const response = await apiClient.get<ShiftTemplate[]>(`${BASE}/shift-templates`, { params });
    return response.data;
  },

  createShiftTemplate: async (data: ShiftTemplateCreate): Promise<ShiftTemplate> => {
    const response = await apiClient.post<ShiftTemplate>(`${BASE}/shift-templates`, data);
    return response.data;
  },

  updateShiftTemplate: async (id: string, data: Partial<ShiftTemplateCreate & { is_active?: boolean }>): Promise<ShiftTemplate> => {
    const response = await apiClient.patch<ShiftTemplate>(`${BASE}/shift-templates/${id}`, data);
    return response.data;
  },

  deleteShiftTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/shift-templates/${id}`);
  },

  // --- Schedules ---
  getSchedules: async (params?: { date_from?: string; date_to?: string; employee_id?: string }): Promise<Schedule[]> => {
    const response = await apiClient.get<Schedule[]>(`${BASE}/schedules`, { params });
    return response.data;
  },

  createSchedule: async (data: ScheduleCreate): Promise<Schedule> => {
    const response = await apiClient.post<Schedule>(`${BASE}/schedules`, data);
    return response.data;
  },

  createBulkSchedules: async (schedules: ScheduleCreate[]): Promise<Schedule[]> => {
    const response = await apiClient.post<Schedule[]>(`${BASE}/schedules/bulk`, { schedules });
    return response.data;
  },

  getEmployeeSchedule: async (employeeId: string, dateFrom: string, dateTo: string): Promise<Schedule[]> => {
    const response = await apiClient.get<Schedule[]>(`${BASE}/schedules/employee/${employeeId}`, {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return response.data;
  },

  deleteSchedule: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/schedules/${id}`);
  },

  // --- Attendance ---
  getAttendanceRecords: async (params?: {
    record_date?: string;
    employee_id?: string;
    status?: AttendanceStatus;
    date_from?: string;
    date_to?: string;
  }): Promise<AttendanceRecord[]> => {
    const response = await apiClient.get<AttendanceRecord[]>(`${BASE}/attendance`, { params });
    return response.data;
  },

  logAttendance: async (data: AttendanceCreate): Promise<AttendanceRecord> => {
    const response = await apiClient.post<AttendanceRecord>(`${BASE}/attendance`, data);
    return response.data;
  },

  updateAttendance: async (id: string, data: Partial<AttendanceCreate>): Promise<AttendanceRecord> => {
    const response = await apiClient.patch<AttendanceRecord>(`${BASE}/attendance/${id}`, data);
    return response.data;
  },

  getDailyAttendanceSummary: async (targetDate?: string): Promise<DailyAttendanceSummary> => {
    const response = await apiClient.get<DailyAttendanceSummary>(`${BASE}/attendance/daily`, {
      params: targetDate ? { target_date: targetDate } : undefined,
    });
    return response.data;
  },

  // --- Absences ---
  getAbsences: async (params?: {
    employee_id?: string;
    absence_type?: AbsenceType;
    date_from?: string;
    date_to?: string;
    is_deductible?: boolean;
  }): Promise<AbsenceRecord[]> => {
    const response = await apiClient.get<AbsenceRecord[]>(`${BASE}/absences`, { params });
    return response.data;
  },

  createAbsence: async (data: AbsenceCreate): Promise<AbsenceRecord> => {
    const response = await apiClient.post<AbsenceRecord>(`${BASE}/absences`, data);
    return response.data;
  },

  approveAbsence: async (id: string): Promise<AbsenceRecord> => {
    const response = await apiClient.post<AbsenceRecord>(`${BASE}/absences/${id}/approve`);
    return response.data;
  },

  // --- Checklist Templates ---
  getChecklistTemplates: async (params?: {
    position?: string;
    assignment_type?: AssignmentType;
    employee_id?: string;
    is_active?: boolean;
  }): Promise<ChecklistTemplate[]> => {
    const response = await apiClient.get<ChecklistTemplate[]>(`${BASE}/checklist-templates`, { params });
    return response.data;
  },

  createChecklistTemplate: async (data: ChecklistTemplateCreate): Promise<ChecklistTemplate> => {
    const response = await apiClient.post<ChecklistTemplate>(`${BASE}/checklist-templates`, data);
    return response.data;
  },

  updateChecklistTemplate: async (id: string, data: ChecklistTemplateUpdate): Promise<ChecklistTemplate> => {
    const response = await apiClient.patch<ChecklistTemplate>(`${BASE}/checklist-templates/${id}`, data);
    return response.data;
  },

  addChecklistTemplateItem: async (templateId: string, data: { description: string; sort_order?: number; is_required?: boolean }): Promise<ChecklistTemplateItem> => {
    const response = await apiClient.post<ChecklistTemplateItem>(`${BASE}/checklist-templates/${templateId}/items`, data);
    return response.data;
  },

  deleteChecklistTemplateItem: async (itemId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/checklist-templates/items/${itemId}`);
  },

  // --- Daily Checklists ---
  getDailyChecklists: async (params?: { checklist_date?: string; employee_id?: string }): Promise<DailyChecklist[]> => {
    const response = await apiClient.get<DailyChecklist[]>(`${BASE}/checklists`, { params });
    return response.data;
  },

  generateDailyChecklists: async (targetDate?: string): Promise<DailyChecklist[]> => {
    const response = await apiClient.post<DailyChecklist[]>(`${BASE}/checklists/generate`, null, {
      params: targetDate ? { target_date: targetDate } : undefined,
    });
    return response.data;
  },

  getDailyChecklist: async (id: string): Promise<DailyChecklist> => {
    const response = await apiClient.get<DailyChecklist>(`${BASE}/checklists/${id}`);
    return response.data;
  },

  updateChecklistItemStatus: async (itemId: string, data: { status: ChecklistItemStatus; notes?: string }): Promise<DailyChecklistItem> => {
    const response = await apiClient.patch<DailyChecklistItem>(`${BASE}/checklists/items/${itemId}`, data);
    return response.data;
  },

  verifyChecklist: async (id: string, notes?: string): Promise<DailyChecklist> => {
    const response = await apiClient.post<DailyChecklist>(`${BASE}/checklists/${id}/verify`, notes ? { notes } : undefined);
    return response.data;
  },

  // --- Performance ---
  getEmployeeMetrics: async (employeeId: string, periodStart: string, periodEnd: string): Promise<EmployeePerformanceMetrics> => {
    const response = await apiClient.get<EmployeePerformanceMetrics>(`${BASE}/performance/employee/${employeeId}`, {
      params: { period_start: periodStart, period_end: periodEnd },
    });
    return response.data;
  },

  getPerformanceSummary: async (params?: { period_start?: string; period_end?: string }): Promise<PerformanceSummaryItem[]> => {
    const response = await apiClient.get<PerformanceSummaryItem[]>(`${BASE}/performance/summary`, { params });
    return response.data;
  },

  getPerformanceReviews: async (params?: { employee_id?: string; review_period?: string }): Promise<PerformanceReview[]> => {
    const response = await apiClient.get<PerformanceReview[]>(`${BASE}/performance/reviews`, { params });
    return response.data;
  },

  generatePerformanceReview: async (data: {
    employee_id: string;
    review_period: 'weekly' | 'monthly' | 'quarterly';
    period_start: string;
    period_end: string;
  }): Promise<PerformanceReview> => {
    const response = await apiClient.post<PerformanceReview>(`${BASE}/performance/reviews/generate`, data);
    return response.data;
  },

  updatePerformanceReview: async (id: string, data: { reviewer_notes?: string }): Promise<PerformanceReview> => {
    const response = await apiClient.patch<PerformanceReview>(`${BASE}/performance/reviews/${id}`, data);
    return response.data;
  },

  // --- Position Responsibilities ---
  getResponsibilities: async (params?: {
    position?: string;
    assignment_type?: AssignmentType;
    employee_id?: string;
    is_active?: boolean;
  }): Promise<PositionResponsibility[]> => {
    const response = await apiClient.get<PositionResponsibility[]>(`${BASE}/responsibilities`, { params });
    return response.data;
  },

  getEmployeeResponsibilities: async (employeeId: string): Promise<PositionResponsibility[]> => {
    const response = await apiClient.get<PositionResponsibility[]>(`${BASE}/responsibilities/employee/${employeeId}`);
    return response.data;
  },

  createResponsibility: async (data: PositionResponsibilityCreate): Promise<PositionResponsibility> => {
    const response = await apiClient.post<PositionResponsibility>(`${BASE}/responsibilities`, data);
    return response.data;
  },

  updateResponsibility: async (id: string, data: PositionResponsibilityUpdate): Promise<PositionResponsibility> => {
    const response = await apiClient.patch<PositionResponsibility>(`${BASE}/responsibilities/${id}`, data);
    return response.data;
  },

  deleteResponsibility: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/responsibilities/${id}`);
  },
};

export default workforceService;
