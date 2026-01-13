/**
 * Librarian AI Agent Service
 * API client for Librarian endpoints
 */

import { client as api } from './api';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface LibrarianConfig {
  daily_schedule: ScheduleConfig;
  weekly_schedule: ScheduleConfig;
  audit_limits: AuditLimits;
  pagination: PaginationConfig;
  ui: UIConfig;
  action_types: ActionType[];
  gcp_project_id: string;
}

export interface ScheduleConfig {
  cron: string;
  time: string;
  mode: string;
  cost: string;
  status: string;
  description: string;
}

export interface AuditLimits {
  max_iterations: number;
  default_budget_usd: number;
  min_budget_usd: number;
  max_budget_usd: number;
  budget_step_usd: number;
}

export interface PaginationConfig {
  reports_limit: number;
  actions_limit: number;
  activity_page_size: number;
}

export interface UIConfig {
  id_truncate_length: number;
  modal_max_height: number;
}

export interface ActionType {
  value: string;
  label: string;
  color: string;
  icon: string;
}

export interface LibrarianStatus {
  last_audit_date: string | null;
  last_audit_status: string | null;
  total_audits_last_30_days: number;
  avg_execution_time: number;
  total_issues_fixed: number;
  system_health: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export interface AuditReport {
  audit_id: string;
  audit_type: string;
  audit_date: string;
  status: string;
  execution_time_seconds: number;
  summary: AuditSummary;
  issues_count?: number;
  fixes_count?: number;
}

export interface AuditSummary {
  total_items: number;
  healthy_items: number;
  issues_found: number;
  issues_fixed: number;
  manual_review_needed: number;
}

export interface AuditReportDetail extends AuditReport {
  content_results: Record<string, any>;
  broken_streams: any[];
  missing_metadata: any[];
  misclassifications: any[];
  orphaned_items: any[];
  fixes_applied: any[];
  database_health: Record<string, any>;
  ai_insights: string[];
  execution_logs: LogEntry[];
  completed_at: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
}

export interface LibrarianAction {
  action_id: string;
  audit_id: string;
  timestamp: string;
  action_type: string;
  content_id: string;
  content_type: string;
  issue_type: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  confidence_score?: number;
  auto_approved: boolean;
  rollback_available: boolean;
  rolled_back: boolean;
  rollback_timestamp?: string;
  rollback_reason?: string;
  description?: string;
  error_message?: string;
  content_title?: string;
}

export interface TriggerAuditRequest {
  audit_type: string;
  dry_run: boolean;
  use_ai_agent: boolean;
  max_iterations: number;
  budget_limit_usd: number;
}

export interface TriggerAuditResponse {
  audit_id: string;
  status: string;
  message: string;
}

export interface RollbackResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Get Librarian configuration
 */
export const getLibrarianConfig = async (): Promise<LibrarianConfig> => {
  const response = await api.get('/admin/librarian/config');
  return response.data;
};

/**
 * Get Librarian status and statistics
 */
export const getLibrarianStatus = async (): Promise<LibrarianStatus> => {
  const response = await api.get('/admin/librarian/status');
  return response.data;
};

/**
 * Trigger a new audit
 */
export const triggerAudit = async (request: TriggerAuditRequest): Promise<TriggerAuditResponse> => {
  const response = await api.post('/admin/librarian/run-audit', request);
  return response.data;
};

/**
 * Get recent audit reports
 */
export const getAuditReports = async (limit: number = 10, auditType?: string): Promise<AuditReport[]> => {
  const params: any = { limit };
  if (auditType) {
    params.audit_type = auditType;
  }
  const response = await api.get('/admin/librarian/reports', { params });
  return response.data;
};

/**
 * Get detailed audit report
 */
export const getAuditReportDetails = async (auditId: string): Promise<AuditReportDetail> => {
  const response = await api.get(`/admin/librarian/reports/${auditId}`);
  return response.data;
};

/**
 * Get librarian actions
 */
export const getLibrarianActions = async (
  auditId?: string,
  actionType?: string,
  limit: number = 50
): Promise<LibrarianAction[]> => {
  const params: any = { limit };
  if (auditId) {
    params.audit_id = auditId;
  }
  if (actionType) {
    params.action_type = actionType;
  }
  const response = await api.get('/admin/librarian/actions', { params });
  return response.data;
};

/**
 * Rollback a specific action
 */
export const rollbackAction = async (actionId: string): Promise<RollbackResponse> => {
  const response = await api.post(`/admin/librarian/actions/${actionId}/rollback`);
  return response.data;
};

export default {
  getLibrarianConfig,
  getLibrarianStatus,
  triggerAudit,
  getAuditReports,
  getAuditReportDetails,
  getLibrarianActions,
  rollbackAction,
};
