/**
 * Librarian AI Agent Admin Page
 * Main interface for Librarian system monitoring and control
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bot, PlayCircle, CheckCircle, FileText, RefreshCw, Calendar, DollarSign, X, Loader2, Copy, Check } from 'lucide-react';
import {
  getLibrarianConfig,
  getLibrarianStatus,
  triggerAudit,
  getAuditReports,
  getAuditReportDetails,
  type LibrarianConfig,
  type LibrarianStatus,
  type AuditReport,
  type AuditReportDetail,
} from '../../services/librarianService';
import { useTranslation } from 'react-i18next';
import { toast } from '../../store/toastStore';

export default function LibrarianAgentPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<LibrarianConfig | null>(null);
  const [status, setStatus] = useState<LibrarianStatus | null>(null);
  const [reports, setReports] = useState<AuditReport[]>([]);
  
  // Modal states
  const [selectedReport, setSelectedReport] = useState<AuditReportDetail | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLiveLogModal, setShowLiveLogModal] = useState(false);
  const [liveAuditId, setLiveAuditId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [liveReportData, setLiveReportData] = useState<AuditReportDetail | null>(null);
  
  // Audit trigger states
  const [dryRun, setDryRun] = useState(true);
  const [useAIAgent, setUseAIAgent] = useState(true); // Default to AI Agent mode
  const [budget, setBudget] = useState(1.0);
  const [triggering, setTriggering] = useState(false);
  
  // Refs for polling
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Copy state
  const [copied, setCopied] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [configData, statusData, reportsData] = await Promise.all([
        getLibrarianConfig(),
        getLibrarianStatus(),
        getAuditReports(10),
      ]);
      
      setConfig(configData);
      setStatus(statusData);
      setReports(reportsData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load librarian data:', error);
      toast.error(t('admin.librarian.errors.failedToLoad'));
      setLoading(false);
    }
  };

  const startLiveLogPolling = (auditId: string) => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds for live updates
    pollIntervalRef.current = setInterval(async () => {
      try {
        const report = await getAuditReportDetails(auditId);
        setLiveReportData(report);
        setLiveLogs(report.execution_logs || []);

        // Stop polling if audit is complete
        if (report.status === 'completed' || report.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          // Refresh the main data
          loadData();
          
          // Show completion toast
          if (report.status === 'completed') {
            toast.success('Audit completed successfully!');
          } else {
            toast.error('Audit failed');
          }
        }
      } catch (error) {
        console.error('Failed to fetch live logs:', error);
      }
    }, 2000);
  };

  const handleTriggerAudit = async (auditType: string) => {
    setTriggering(true);
    
    // Small delay to ensure spinner is visible
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const response = await triggerAudit({
        audit_type: auditType,
        dry_run: dryRun,
        use_ai_agent: useAIAgent,
        max_iterations: config?.audit_limits.max_iterations || 50,
        budget_limit_usd: budget,
      });
      
      toast.success(t('admin.librarian.quickActions.success'));
      
      // Open live log modal
      setLiveAuditId(response.audit_id);
      setLiveLogs([]);
      setLiveReportData(null);
      setShowLiveLogModal(true);
      
      // Start polling for live updates
      startLiveLogPolling(response.audit_id);
      
    } catch (error) {
      console.error('Failed to trigger audit:', error);
      toast.error(t('admin.librarian.errors.failedToLoad'));
    } finally {
      setTriggering(false);
    }
  };

  const closeLiveLogModal = () => {
    setShowLiveLogModal(false);
    setLiveAuditId(null);
    setLiveLogs([]);
    setLiveReportData(null);
    setCopied(false);
    
    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const copyLogsToClipboard = async () => {
    try {
      // Format logs as plain text (reversed to match display order - newest first)
      const formattedLogs = [...liveLogs].reverse().map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        });
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
      }).join('\n');

      // Add header
      const header = `=== Librarian AI Audit Log ===\nAudit ID: ${liveAuditId}\nStatus: ${liveReportData?.status || 'in_progress'}\n${'='.repeat(50)}\n\n`;
      
      const fullText = header + formattedLogs;

      await navigator.clipboard.writeText(fullText);
      
      setCopied(true);
      toast.success('Logs copied to clipboard!');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
      toast.error('Failed to copy logs to clipboard');
    }
  };

  const copyReportToClipboard = async () => {
    if (!selectedReport) return;
    
    try {
      // Format report as plain text
      const header = `=== Librarian AI Audit Report ===
Audit ID: ${selectedReport.audit_id}
Date: ${new Date(selectedReport.audit_date).toLocaleString()}
Type: ${selectedReport.audit_type}
Status: ${selectedReport.status}
Execution Time: ${selectedReport.execution_time_seconds.toFixed(1)}s
${'='.repeat(50)}

`;

      const summary = `SUMMARY
-------
Total Items: ${selectedReport.summary?.total_items || 0}
Issues Found: ${selectedReport.summary?.issues_found || 0}
Issues Fixed: ${selectedReport.summary?.issues_fixed || 0}
Healthy Items: ${selectedReport.summary?.healthy_items || 0}

`;

      let aiInsights = '';
      if (selectedReport.ai_insights && selectedReport.ai_insights.length > 0) {
        aiInsights = `AI INSIGHTS
-----------
${selectedReport.ai_insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

`;
      }

      let logs = '';
      if (selectedReport.execution_logs && selectedReport.execution_logs.length > 0) {
        logs = `EXECUTION LOGS
--------------
${[...selectedReport.execution_logs].reverse().map(log => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3
          });
          return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
        }).join('\n')}
`;
      }

      const fullText = header + summary + aiInsights + logs;

      await navigator.clipboard.writeText(fullText);
      
      setCopiedReport(true);
      toast.success('Report copied to clipboard!');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedReport(false), 2000);
    } catch (error) {
      console.error('Failed to copy report:', error);
      toast.error('Failed to copy report to clipboard');
    }
  };

  const handleViewReport = async (auditId: string) => {
    try {
      setCopiedReport(false); // Reset copy state when opening new report
      const report = await getAuditReportDetails(auditId);
      setSelectedReport(report);
      setShowReportModal(true);
    } catch (error) {
      console.error('Failed to load report details:', error);
      toast.error('Failed to load report details');
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return 'text-emerald-400';
      case 'good':
        return 'text-blue-400';
      case 'fair':
        return 'text-amber-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-dark-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      in_progress: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
      partial: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    };
    return colors[status as keyof typeof colors] || 'bg-dark-500/20 text-dark-400 border border-dark-500/30';
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-amber-400';
      case 'success':
        return 'text-emerald-400';
      case 'info':
      default:
        return 'text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
          <p className="text-dark-400">{t('admin.librarian.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-dark-100">
            <Bot className="w-8 h-8 text-primary-400" />
            {t('admin.librarian.title')}
          </h1>
          <p className="text-dark-400 mt-2">{t('admin.librarian.subtitle')}</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 glass-button flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('admin.librarian.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className={`w-6 h-6 ${getHealthColor(status?.system_health || 'unknown')}`} />
            <h3 className="text-sm text-dark-400">{t('admin.librarian.stats.systemHealth')}</h3>
          </div>
          <p className="text-2xl font-bold text-dark-100 capitalize">{status?.system_health || 'unknown'}</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-blue-400" />
            <h3 className="text-sm text-dark-400">{t('admin.librarian.stats.totalAudits')}</h3>
          </div>
          <p className="text-2xl font-bold text-dark-100">{status?.total_audits_last_30_days || 0}</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <h3 className="text-sm text-dark-400">{t('admin.librarian.stats.issuesFixed')}</h3>
          </div>
          <p className="text-2xl font-bold text-dark-100">{status?.total_issues_fixed || 0}</p>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-purple-400" />
            <h3 className="text-sm text-dark-400">{t('admin.librarian.stats.lastAudit')}</h3>
          </div>
          <p className="text-sm text-dark-200">
            {status?.last_audit_date
              ? new Date(status.last_audit_date).toLocaleDateString()
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 text-dark-100">{t('admin.librarian.quickActions.title')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div 
              onClick={() => setDryRun(!dryRun)}
              className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                dryRun 
                  ? 'bg-primary-500/20 border-primary-400' 
                  : 'bg-dark-700/50 border-white/20 group-hover:border-white/30'
              }`}
            >
              {dryRun && (
                <svg className="w-3 h-3 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-dark-200 group-hover:text-dark-100 transition-colors">
              {t('admin.librarian.quickActions.dryRun')} (Preview only)
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div 
              onClick={() => setUseAIAgent(!useAIAgent)}
              className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                useAIAgent 
                  ? 'bg-primary-500/20 border-primary-400' 
                  : 'bg-dark-700/50 border-white/20 group-hover:border-white/30'
              }`}
            >
              {useAIAgent && (
                <svg className="w-3 h-3 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-dark-200 group-hover:text-dark-100 transition-colors">
              Use AI Agent Mode
            </span>
          </label>
        </div>

        {useAIAgent && (
          <div className="mb-4 glass-light rounded-xl p-4">
            <label className="block text-sm mb-2 text-dark-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Budget: ${budget.toFixed(2)}
            </label>
            <input
              type="range"
              min={config?.audit_limits.min_budget_usd || 0.25}
              max={config?.audit_limits.max_budget_usd || 15}
              step={config?.audit_limits.budget_step_usd || 0.25}
              value={budget}
              onChange={(e) => setBudget(parseFloat(e.target.value))}
              className="w-full h-2 bg-dark-700/50 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-dark-400 mt-1">
              <span>${config?.audit_limits.min_budget_usd || 0.25}</span>
              <span>${config?.audit_limits.max_budget_usd || 15}</span>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => handleTriggerAudit('daily_incremental')}
            disabled={triggering}
            className="flex-1 px-4 py-3 glass-button-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
            {t('admin.librarian.quickActions.triggerDaily')}
          </button>

          <button
            onClick={() => handleTriggerAudit('weekly_full')}
            disabled={triggering}
            className="flex-1 px-4 py-3 glass-button flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.8) 0%, rgba(139, 92, 246, 0.8) 100%)' }}
          >
            {triggering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5" />
            )}
            {t('admin.librarian.quickActions.triggerWeekly')}
          </button>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4 text-dark-100">{t('admin.librarian.reports.title')}</h2>
        
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-dark-600" />
            <p className="text-dark-400">{t('admin.librarian.reports.emptyMessage')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Issues</th>
                  <th>Fixes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.audit_id}>
                    <td className="text-dark-200">
                      {new Date(report.audit_date).toLocaleString()}
                    </td>
                    <td className="text-dark-200 capitalize">
                      {report.audit_type.replace('_', ' ')}
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-lg text-xs ${getStatusBadge(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="text-dark-200">{report.summary?.issues_found || 0}</td>
                    <td className="text-dark-200">{report.summary?.issues_fixed || 0}</td>
                    <td>
                      <button
                        onClick={() => handleViewReport(report.audit_id)}
                        className="px-3 py-1 glass-button text-sm"
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

      {/* Live Log Modal */}
      {showLiveLogModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-5xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
                    {liveReportData?.status === 'in_progress' ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                    ) : liveReportData?.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <Bot className="w-6 h-6 text-primary-400" />
                    )}
                    Live Audit Execution
                  </h2>
                  <p className="text-sm text-dark-400 mt-1">
                    Audit ID: {liveAuditId?.substring(0, 8)}... • 
                    Status: <span className="capitalize">{liveReportData?.status || 'starting'}</span>
                  </p>
                </div>
                <button
                  onClick={closeLiveLogModal}
                  className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress Summary */}
              {liveReportData?.summary && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="glass-light p-3 rounded-lg">
                    <p className="text-xs text-dark-400">Items</p>
                    <p className="text-lg font-bold text-dark-100">{liveReportData.summary.total_items || 0}</p>
                  </div>
                  <div className="glass-light p-3 rounded-lg">
                    <p className="text-xs text-dark-400">Issues Found</p>
                    <p className="text-lg font-bold text-dark-100">{liveReportData.summary.issues_found || 0}</p>
                  </div>
                  <div className="glass-light p-3 rounded-lg">
                    <p className="text-xs text-dark-400">Fixed</p>
                    <p className="text-lg font-bold text-emerald-400">{liveReportData.summary.issues_fixed || 0}</p>
                  </div>
                  <div className="glass-light p-3 rounded-lg">
                    <p className="text-xs text-dark-400">Time</p>
                    <p className="text-lg font-bold text-dark-100">
                      {liveReportData.execution_time_seconds ? `${liveReportData.execution_time_seconds.toFixed(1)}s` : '0s'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Log Content */}
            <div className="flex-1 overflow-hidden p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-dark-300">Execution Logs</h3>
                <button
                  onClick={copyLogsToClipboard}
                  disabled={liveLogs.length === 0}
                  className="px-3 py-1.5 glass-button text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Logs</span>
                    </>
                  )}
                </button>
              </div>
              <div 
                ref={logContainerRef}
                className="glass-light rounded-lg p-4 h-full overflow-y-auto font-mono text-sm space-y-1"
                style={{ maxHeight: 'calc(100% - 2.5rem)' }}
              >
                {liveLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-dark-400">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p>Waiting for audit to start...</p>
                    </div>
                  </div>
                ) : (
                  [...liveLogs].reverse().map((log, index) => (
                    <div key={log.id || index} className="flex gap-3 hover:bg-white/5 px-3 py-1.5 rounded">
                      <span className="text-dark-500 text-xs shrink-0 font-medium min-w-[90px]">
                        {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          fractionalSecondDigits: 3
                        })}
                      </span>
                      <span className={`uppercase text-xs font-bold shrink-0 w-14 ${getLogLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="text-dark-200 flex-1 leading-relaxed">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-dark-400">
                {liveReportData?.status === 'in_progress' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Audit in progress...</span>
                  </>
                ) : liveReportData?.status === 'completed' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Audit completed successfully</span>
                  </>
                ) : liveReportData?.status === 'failed' ? (
                  <>
                    <X className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Audit failed</span>
                  </>
                ) : null}
              </div>
              <button
                onClick={closeLiveLogModal}
                className="px-4 py-2 glass-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-dark-100">Audit Report Details</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyReportToClipboard}
                    className="px-3 py-1.5 glass-button text-sm flex items-center gap-2"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Report</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 text-dark-100">Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-light p-3 rounded-lg">
                      <p className="text-sm text-dark-400">Total Items</p>
                      <p className="text-xl font-bold text-dark-100">{selectedReport.summary?.total_items || 0}</p>
                    </div>
                    <div className="glass-light p-3 rounded-lg">
                      <p className="text-sm text-dark-400">Issues Found</p>
                      <p className="text-xl font-bold text-dark-100">{selectedReport.summary?.issues_found || 0}</p>
                    </div>
                    <div className="glass-light p-3 rounded-lg">
                      <p className="text-sm text-dark-400">Issues Fixed</p>
                      <p className="text-xl font-bold text-dark-100">{selectedReport.summary?.issues_fixed || 0}</p>
                    </div>
                    <div className="glass-light p-3 rounded-lg">
                      <p className="text-sm text-dark-400">Execution Time</p>
                      <p className="text-xl font-bold text-dark-100">{selectedReport.execution_time_seconds.toFixed(1)}s</p>
                    </div>
                  </div>
                </div>

                {selectedReport.ai_insights && selectedReport.ai_insights.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-dark-100">AI Insights</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedReport.ai_insights.map((insight, idx) => (
                        <li key={idx} className="text-sm text-dark-300">{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedReport.execution_logs && selectedReport.execution_logs.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-dark-100">Execution Logs</h3>
                    <div className="glass-light p-3 rounded-lg max-h-60 overflow-y-auto space-y-1 font-mono text-xs">
                      {[...selectedReport.execution_logs].reverse().map((log) => (
                        <div key={log.id} className="flex gap-3 hover:bg-white/5 px-2 py-1 rounded">
                          <span className="text-dark-500 shrink-0 font-medium min-w-[90px]">
                            {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              fractionalSecondDigits: 3
                            })}
                          </span>
                          <span className={`uppercase font-bold shrink-0 w-14 ${getLogLevelColor(log.level)}`}>
                            [{log.level}]
                          </span>
                          <span className="text-dark-300 flex-1">{log.message}</span>
                        </div>
                      ))}
                    </div>
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
