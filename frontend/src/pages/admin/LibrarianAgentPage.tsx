/**
 * Librarian AI Agent Admin Page
 * Main interface for Librarian system monitoring and control
 */

import React, { useState, useEffect } from 'react';
import { Bot, PlayCircle, AlertTriangle, CheckCircle, FileText, RefreshCw, Calendar, DollarSign } from 'lucide-react';
import {
  getLibrarianConfig,
  getLibrarianStatus,
  triggerAudit,
  getAuditReports,
  getAuditReportDetails,
  getLibrarianActions,
  type LibrarianConfig,
  type LibrarianStatus,
  type AuditReport,
  type AuditReportDetail,
  type LibrarianAction,
} from '../../services/librarianService';
import { useTranslation } from 'react-i18next';

export default function LibrarianAgentPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<LibrarianConfig | null>(null);
  const [status, setStatus] = useState<LibrarianStatus | null>(null);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [actions, setActions] = useState<LibrarianAction[]>([]);
  
  // Modal states
  const [selectedReport, setSelectedReport] = useState<AuditReportDetail | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Audit trigger states
  const [dryRun, setDryRun] = useState(true);
  const [useAIAgent, setUseAIAgent] = useState(false);
  const [budget, setBudget] = useState(1.0);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [configData, statusData, reportsData, actionsData] = await Promise.all([
        getLibrarianConfig(),
        getLibrarianStatus(),
        getAuditReports(10),
        getLibrarianActions(undefined, undefined, 50),
      ]);
      
      setConfig(configData);
      setStatus(statusData);
      setReports(reportsData);
      setActions(actionsData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load librarian data:', error);
      setLoading(false);
    }
  };

  const handleTriggerAudit = async (auditType: string) => {
    setTriggering(true);
    try {
      await triggerAudit({
        audit_type: auditType,
        dry_run: dryRun,
        use_ai_agent: useAIAgent,
        max_iterations: config?.audit_limits.max_iterations || 50,
        budget_limit_usd: budget,
      });
      
      alert(t('admin.librarian.quickActions.success'));
      
      // Refresh data after trigger
      setTimeout(loadData, 2000);
    } catch (error) {
      console.error('Failed to trigger audit:', error);
      alert(t('admin.librarian.errors.failedToLoad'));
    } finally {
      setTriggering(false);
      setShowConfirmModal(false);
    }
  };

  const handleViewReport = async (auditId: string) => {
    try {
      const report = await getAuditReportDetails(auditId);
      setSelectedReport(report);
      setShowReportModal(true);
    } catch (error) {
      console.error('Failed to load report details:', error);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-blue-400';
      case 'fair':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-500/20 text-green-400',
      in_progress: 'bg-blue-500/20 text-blue-400',
      failed: 'bg-red-500/20 text-red-400',
      partial: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-400">{t('admin.librarian.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-400" />
            {t('admin.librarian.title')}
          </h1>
          <p className="text-gray-400 mt-2">{t('admin.librarian.subtitle')}</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('admin.librarian.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className={`w-6 h-6 ${getHealthColor(status?.system_health || 'unknown')}`} />
            <h3 className="text-sm text-gray-400">{t('admin.librarian.stats.systemHealth')}</h3>
          </div>
          <p className="text-2xl font-bold capitalize">{status?.system_health || 'unknown'}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-blue-400" />
            <h3 className="text-sm text-gray-400">{t('admin.librarian.stats.totalAudits')}</h3>
          </div>
          <p className="text-2xl font-bold">{status?.total_audits_last_30_days || 0}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-sm text-gray-400">{t('admin.librarian.stats.issuesFixed')}</h3>
          </div>
          <p className="text-2xl font-bold">{status?.total_issues_fixed || 0}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-purple-400" />
            <h3 className="text-sm text-gray-400">{t('admin.librarian.stats.lastAudit')}</h3>
          </div>
          <p className="text-sm">
            {status?.last_audit_date
              ? new Date(status.last_audit_date).toLocaleDateString()
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">{t('admin.librarian.quickActions.title')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="dryRun" className="text-sm">
              {t('admin.librarian.quickActions.dryRun')} (Preview only)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useAI"
              checked={useAIAgent}
              onChange={(e) => setUseAIAgent(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="useAI" className="text-sm">
              Use AI Agent Mode
            </label>
          </div>
        </div>

        {useAIAgent && (
          <div className="mb-4">
            <label className="block text-sm mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Budget: ${budget.toFixed(2)}
            </label>
            <input
              type="range"
              min={config?.audit_limits.min_budget_usd || 0.25}
              max={config?.audit_limits.max_budget_usd || 15}
              step={config?.audit_limits.budget_step_usd || 0.25}
              value={budget}
              onChange={(e) => setBudget(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => handleTriggerAudit('daily_incremental')}
            disabled={triggering}
            className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded-lg flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            {t('admin.librarian.quickActions.triggerDaily')}
          </button>

          <button
            onClick={() => handleTriggerAudit('weekly_full')}
            disabled={triggering}
            className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 rounded-lg flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            {t('admin.librarian.quickActions.triggerWeekly')}
          </button>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">{t('admin.librarian.reports.title')}</h2>
        
        {reports.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            {t('admin.librarian.reports.emptyMessage')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4">Date</th>
                  <th className="text-left py-2 px-4">Type</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-left py-2 px-4">Issues</th>
                  <th className="text-left py-2 px-4">Fixes</th>
                  <th className="text-left py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.audit_id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">
                      {new Date(report.audit_date).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 capitalize">{report.audit_type.replace('_', ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{report.summary?.issues_found || 0}</td>
                    <td className="py-3 px-4">{report.summary?.issues_fixed || 0}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleViewReport(report.audit_id)}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Detail Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Audit Report Details</h2>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-700/50 p-3 rounded">
                      <p className="text-sm text-gray-400">Total Items</p>
                      <p className="text-xl font-bold">{selectedReport.summary?.total_items || 0}</p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                      <p className="text-sm text-gray-400">Issues Found</p>
                      <p className="text-xl font-bold">{selectedReport.summary?.issues_found || 0}</p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                      <p className="text-sm text-gray-400">Issues Fixed</p>
                      <p className="text-xl font-bold">{selectedReport.summary?.issues_fixed || 0}</p>
                    </div>
                    <div className="bg-gray-700/50 p-3 rounded">
                      <p className="text-sm text-gray-400">Execution Time</p>
                      <p className="text-xl font-bold">{selectedReport.execution_time_seconds.toFixed(1)}s</p>
                    </div>
                  </div>
                </div>

                {selectedReport.ai_insights && selectedReport.ai_insights.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">AI Insights</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedReport.ai_insights.map((insight, idx) => (
                        <li key={idx} className="text-sm text-gray-300">{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
