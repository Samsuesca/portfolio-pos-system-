import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import workforceService from '../workforceService';
import type {
  ShiftTemplate,
  Schedule,
  AttendanceRecord,
  DailyAttendanceSummary,
  AbsenceRecord,
  ChecklistTemplate,
  ChecklistTemplateItem,
  DailyChecklist,
  DailyChecklistItem,
  EmployeePerformanceMetrics,
  PerformanceReview,
  PositionResponsibility,
} from '../workforceService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const BASE = '/global/workforce';

const mockShift: ShiftTemplate = {
  id: 'sh-1', name: 'Manana', shift_type: 'morning', start_time: '07:00', end_time: '12:00',
  break_minutes: 15, description: null, is_active: true, created_at: '2026-01-01T00:00:00',
};

const mockSchedule: Schedule = {
  id: 'sc-1', employee_id: 'emp-1', employee_name: 'Ana', shift_template_id: 'sh-1',
  shift_template_name: 'Manana', schedule_date: '2026-04-10', start_time: '07:00',
  end_time: '12:00', notes: null, created_at: '2026-04-01T00:00:00',
};

const mockAttendance: AttendanceRecord = {
  id: 'att-1', employee_id: 'emp-1', employee_name: 'Ana', record_date: '2026-04-10',
  status: 'present', check_in_time: '07:00', check_out_time: '12:00',
  scheduled_start: '07:00', scheduled_end: '12:00', minutes_late: 0,
  minutes_early_departure: 0, notes: null, recorded_by: null, created_at: '2026-04-10T07:00:00',
};

describe('workforceService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // --- Shift Templates ---
  describe('Shift Templates', () => {
    it('getShiftTemplates returns list', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [mockShift] });
      const result = await workforceService.getShiftTemplates();
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/shift-templates`, { params: undefined });
      expect(result).toHaveLength(1);
    });

    it('createShiftTemplate posts data', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockShift });
      const result = await workforceService.createShiftTemplate({
        name: 'Manana', shift_type: 'morning', start_time: '07:00', end_time: '12:00',
      });
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/shift-templates`, expect.objectContaining({ name: 'Manana' }));
      expect(result.id).toBe('sh-1');
    });

    it('updateShiftTemplate patches data', async () => {
      (apiClient.patch as Mock).mockResolvedValue({ data: { ...mockShift, name: 'Updated' } });
      const result = await workforceService.updateShiftTemplate('sh-1', { name: 'Updated' });
      expect(apiClient.patch).toHaveBeenCalledWith(`${BASE}/shift-templates/sh-1`, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('deleteShiftTemplate calls delete', async () => {
      (apiClient.delete as Mock).mockResolvedValue({});
      await workforceService.deleteShiftTemplate('sh-1');
      expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/shift-templates/sh-1`);
    });
  });

  // --- Schedules ---
  describe('Schedules', () => {
    it('getSchedules returns paginated response', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([mockSchedule]) });
      const result = await workforceService.getSchedules({ date_from: '2026-04-01' });
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/schedules`, { params: { date_from: '2026-04-01' } });
      expect(result.items).toHaveLength(1);
    });

    it('createSchedule posts data', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockSchedule });
      const result = await workforceService.createSchedule({
        employee_id: 'emp-1', schedule_date: '2026-04-10', start_time: '07:00', end_time: '12:00',
      });
      expect(result.id).toBe('sc-1');
    });

    it('createBulkSchedules posts array', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: [mockSchedule] });
      const schedules = [{ employee_id: 'emp-1', schedule_date: '2026-04-10', start_time: '07:00', end_time: '12:00' }];
      const result = await workforceService.createBulkSchedules(schedules);
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/schedules/bulk`, { schedules });
      expect(result).toHaveLength(1);
    });

    it('getEmployeeSchedule returns paginated', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [mockSchedule] });
      const result = await workforceService.getEmployeeSchedule('emp-1', '2026-04-01', '2026-04-30');
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/schedules/employee/emp-1`, {
        params: { date_from: '2026-04-01', date_to: '2026-04-30' },
      });
      expect(result.items).toHaveLength(1);
    });

    it('deleteSchedule calls delete', async () => {
      (apiClient.delete as Mock).mockResolvedValue({});
      await workforceService.deleteSchedule('sc-1');
      expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/schedules/sc-1`);
    });
  });

  // --- Attendance ---
  describe('Attendance', () => {
    it('getAttendanceRecords returns paginated', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([mockAttendance]) });
      const result = await workforceService.getAttendanceRecords({ record_date: '2026-04-10' });
      expect(result.items[0].status).toBe('present');
    });

    it('logAttendance posts data', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockAttendance });
      const result = await workforceService.logAttendance({
        employee_id: 'emp-1', record_date: '2026-04-10', status: 'present',
      });
      expect(result.id).toBe('att-1');
    });

    it('updateAttendance patches data', async () => {
      (apiClient.patch as Mock).mockResolvedValue({ data: { ...mockAttendance, status: 'late' } });
      const result = await workforceService.updateAttendance('att-1', { status: 'late' });
      expect(result.status).toBe('late');
    });

    it('getDailyAttendanceSummary returns summary', async () => {
      const summary: DailyAttendanceSummary = {
        date: '2026-04-10', total_employees: 5, present: 4, absent: 0, late: 1, excused: 0, not_logged: 0,
      };
      (apiClient.get as Mock).mockResolvedValue({ data: summary });
      const result = await workforceService.getDailyAttendanceSummary('2026-04-10');
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/attendance/daily`, { params: { target_date: '2026-04-10' } });
      expect(result.present).toBe(4);
    });

    it('getDailyAttendanceSummary without date passes undefined params', async () => {
      const summary: DailyAttendanceSummary = {
        date: '2026-04-10', total_employees: 5, present: 4, absent: 0, late: 1, excused: 0, not_logged: 0,
      };
      (apiClient.get as Mock).mockResolvedValue({ data: summary });
      await workforceService.getDailyAttendanceSummary();
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/attendance/daily`, { params: undefined });
    });
  });

  // --- Absences ---
  describe('Absences', () => {
    const mockAbsence: AbsenceRecord = {
      id: 'abs-1', employee_id: 'emp-1', employee_name: 'Ana', attendance_record_id: null,
      absence_type: 'sick_leave', absence_date: '2026-04-10', justification: 'Gripe',
      evidence_url: null, is_deductible: false, deduction_amount: 0, approved_by: null,
      approved_at: null, created_by: null, created_at: '2026-04-10T08:00:00',
    };

    it('getAbsences returns paginated', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([mockAbsence]) });
      const result = await workforceService.getAbsences({ employee_id: 'emp-1' });
      expect(result.items).toHaveLength(1);
    });

    it('createAbsence posts data', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockAbsence });
      const result = await workforceService.createAbsence({
        employee_id: 'emp-1', absence_type: 'sick_leave', absence_date: '2026-04-10',
      });
      expect(result.absence_type).toBe('sick_leave');
    });

    it('approveAbsence posts to approve endpoint', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: { ...mockAbsence, approved_by: 'admin-1' } });
      const result = await workforceService.approveAbsence('abs-1');
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/absences/abs-1/approve`);
      expect(result.approved_by).toBe('admin-1');
    });
  });

  // --- Checklist Templates ---
  describe('Checklist Templates', () => {
    const mockTemplate: ChecklistTemplate = {
      id: 'ct-1', name: 'Apertura', assignment_type: 'position', position: 'vendedora',
      employee_id: null, employee_name: null, description: null, is_active: true,
      items: [], created_at: '2026-01-01T00:00:00',
    };

    it('getChecklistTemplates returns list', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [mockTemplate] });
      const result = await workforceService.getChecklistTemplates({ position: 'vendedora' });
      expect(result).toHaveLength(1);
    });

    it('createChecklistTemplate posts data', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockTemplate });
      const result = await workforceService.createChecklistTemplate({ name: 'Apertura' });
      expect(result.name).toBe('Apertura');
    });

    it('updateChecklistTemplate patches data', async () => {
      (apiClient.patch as Mock).mockResolvedValue({ data: { ...mockTemplate, is_active: false } });
      const result = await workforceService.updateChecklistTemplate('ct-1', { is_active: false });
      expect(result.is_active).toBe(false);
    });

    it('addChecklistTemplateItem posts to items endpoint', async () => {
      const mockItem: ChecklistTemplateItem = {
        id: 'cti-1', template_id: 'ct-1', description: 'Abrir caja', sort_order: 1, is_required: true,
        created_at: '2026-01-01T00:00:00',
      };
      (apiClient.post as Mock).mockResolvedValue({ data: mockItem });
      const result = await workforceService.addChecklistTemplateItem('ct-1', { description: 'Abrir caja' });
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/checklist-templates/ct-1/items`, { description: 'Abrir caja' });
      expect(result.description).toBe('Abrir caja');
    });

    it('deleteChecklistTemplateItem calls delete', async () => {
      (apiClient.delete as Mock).mockResolvedValue({});
      await workforceService.deleteChecklistTemplateItem('cti-1');
      expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/checklist-templates/items/cti-1`);
    });
  });

  // --- Daily Checklists ---
  describe('Daily Checklists', () => {
    const mockChecklist: DailyChecklist = {
      id: 'dc-1', employee_id: 'emp-1', employee_name: 'Ana', template_id: 'ct-1',
      checklist_date: '2026-04-10', total_items: 3, completed_items: 2, completion_rate: 66.7,
      verified_by: null, verified_at: null, notes: null, items: [], created_at: '2026-04-10T07:00:00',
    };

    it('getDailyChecklists returns paginated', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([mockChecklist]) });
      const result = await workforceService.getDailyChecklists({ checklist_date: '2026-04-10' });
      expect(result.items).toHaveLength(1);
    });

    it('generateDailyChecklists posts with target date', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: [mockChecklist] });
      const result = await workforceService.generateDailyChecklists('2026-04-10');
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/checklists/generate`, null, {
        params: { target_date: '2026-04-10' },
      });
      expect(result).toHaveLength(1);
    });

    it('generateDailyChecklists without date passes undefined params', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: [] });
      await workforceService.generateDailyChecklists();
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/checklists/generate`, null, { params: undefined });
    });

    it('getDailyChecklist returns single checklist', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: mockChecklist });
      const result = await workforceService.getDailyChecklist('dc-1');
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/checklists/dc-1`);
      expect(result.id).toBe('dc-1');
    });

    it('updateChecklistItemStatus patches item', async () => {
      const mockItem: DailyChecklistItem = {
        id: 'dci-1', checklist_id: 'dc-1', description: 'Abrir caja', sort_order: 1,
        is_required: true, status: 'completed', completed_at: '2026-04-10T07:05:00',
        completed_by: 'emp-1', notes: null,
      };
      (apiClient.patch as Mock).mockResolvedValue({ data: mockItem });
      const result = await workforceService.updateChecklistItemStatus('dci-1', { status: 'completed' });
      expect(apiClient.patch).toHaveBeenCalledWith(`${BASE}/checklists/items/dci-1`, { status: 'completed' });
      expect(result.status).toBe('completed');
    });

    it('verifyChecklist posts to verify endpoint', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: { ...mockChecklist, verified_by: 'admin-1' } });
      const result = await workforceService.verifyChecklist('dc-1', 'Todo OK');
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/checklists/dc-1/verify`, { notes: 'Todo OK' });
      expect(result.verified_by).toBe('admin-1');
    });

    it('verifyChecklist without notes passes undefined', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockChecklist });
      await workforceService.verifyChecklist('dc-1');
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/checklists/dc-1/verify`, undefined);
    });
  });

  // --- Performance ---
  describe('Performance', () => {
    it('getEmployeeMetrics returns metrics', async () => {
      const metrics: EmployeePerformanceMetrics = {
        employee_id: 'emp-1', employee_name: 'Ana', period_start: '2026-04-01', period_end: '2026-04-30',
        attendance_rate: 95, punctuality_rate: 90, checklist_completion_rate: 88,
        total_sales_amount: 5000000, total_sales_count: 50, overall_score: 91,
      };
      (apiClient.get as Mock).mockResolvedValue({ data: metrics });
      const result = await workforceService.getEmployeeMetrics('emp-1', '2026-04-01', '2026-04-30');
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/performance/employee/emp-1`, {
        params: { period_start: '2026-04-01', period_end: '2026-04-30' },
      });
      expect(result.overall_score).toBe(91);
    });

    it('getPerformanceSummary returns paginated', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
      const result = await workforceService.getPerformanceSummary({ period_start: '2026-04-01' });
      expect(result.items).toHaveLength(0);
    });

    it('getPerformanceReviews returns paginated', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([]) });
      const result = await workforceService.getPerformanceReviews({ employee_id: 'emp-1' });
      expect(result.items).toHaveLength(0);
    });

    it('generatePerformanceReview posts data', async () => {
      const review: PerformanceReview = {
        id: 'pr-1', employee_id: 'emp-1', employee_name: 'Ana', review_period: 'monthly',
        period_start: '2026-04-01', period_end: '2026-04-30', attendance_rate: 95,
        punctuality_rate: 90, checklist_completion_rate: 88, total_sales_amount: 5000000,
        total_sales_count: 50, overall_score: 91, reviewer_notes: null, reviewed_by: null,
        reviewed_at: null, created_at: '2026-04-30T18:00:00',
      };
      (apiClient.post as Mock).mockResolvedValue({ data: review });
      const result = await workforceService.generatePerformanceReview({
        employee_id: 'emp-1', review_period: 'monthly', period_start: '2026-04-01', period_end: '2026-04-30',
      });
      expect(apiClient.post).toHaveBeenCalledWith(`${BASE}/performance/reviews/generate`, expect.objectContaining({ employee_id: 'emp-1' }));
      expect(result.id).toBe('pr-1');
    });

    it('updatePerformanceReview patches notes', async () => {
      (apiClient.patch as Mock).mockResolvedValue({ data: { id: 'pr-1', reviewer_notes: 'Buen trabajo' } });
      await workforceService.updatePerformanceReview('pr-1', { reviewer_notes: 'Buen trabajo' });
      expect(apiClient.patch).toHaveBeenCalledWith(`${BASE}/performance/reviews/pr-1`, { reviewer_notes: 'Buen trabajo' });
    });
  });

  // --- Position Responsibilities ---
  describe('Responsibilities', () => {
    const mockResp: PositionResponsibility = {
      id: 'resp-1', assignment_type: 'position', position: 'vendedora', employee_id: null,
      employee_name: null, title: 'Atender clientes', description: null, category: 'customer_service',
      sort_order: 1, is_active: true, created_by: null, created_at: '2026-01-01T00:00:00',
    };

    it('getResponsibilities returns list', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [mockResp] });
      const result = await workforceService.getResponsibilities({ position: 'vendedora' });
      expect(result).toHaveLength(1);
    });

    it('getEmployeeResponsibilities returns list', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [mockResp] });
      const result = await workforceService.getEmployeeResponsibilities('emp-1');
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/responsibilities/employee/emp-1`);
      expect(result).toHaveLength(1);
    });

    it('createResponsibility posts data', async () => {
      (apiClient.post as Mock).mockResolvedValue({ data: mockResp });
      const result = await workforceService.createResponsibility({
        title: 'Atender clientes', category: 'customer_service',
      });
      expect(result.title).toBe('Atender clientes');
    });

    it('updateResponsibility patches data', async () => {
      (apiClient.patch as Mock).mockResolvedValue({ data: { ...mockResp, title: 'Updated' } });
      const result = await workforceService.updateResponsibility('resp-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('deleteResponsibility calls delete', async () => {
      (apiClient.delete as Mock).mockResolvedValue({});
      await workforceService.deleteResponsibility('resp-1');
      expect(apiClient.delete).toHaveBeenCalledWith(`${BASE}/responsibilities/resp-1`);
    });
  });

  // --- Error propagation ---
  describe('error propagation', () => {
    it('propagates errors from getShiftTemplates', async () => {
      (apiClient.get as Mock).mockRejectedValue(new Error('Server error'));
      await expect(workforceService.getShiftTemplates()).rejects.toThrow('Server error');
    });

    it('propagates errors from createSchedule', async () => {
      (apiClient.post as Mock).mockRejectedValue(new Error('Validation error'));
      await expect(workforceService.createSchedule({
        employee_id: 'emp-1', schedule_date: '2026-04-10', start_time: '07:00', end_time: '12:00',
      })).rejects.toThrow('Validation error');
    });
  });
});
