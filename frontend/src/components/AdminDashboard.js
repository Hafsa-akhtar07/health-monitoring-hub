import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastLogsRefreshAt, setLastLogsRefreshAt] = useState(null);
  const refreshTimeoutRef = useRef(null);

  const fetchOverviewAndLogs = async ({ showLoading = true, preserveScroll = false } = {}) => {
    const scrollY = preserveScroll ? window.scrollY : 0;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [overviewRes, logsRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/ocr-logs', { params: { limit: 50 } })
      ]);
      setOverview(overviewRes.data?.data || null);
      setLogs(logsRes.data?.logs || []);
    } catch (err) {
      console.error('Admin dashboard error:', err);
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to load admin dashboard data.';
      setError(message);
    } finally {
      if (showLoading) setLoading(false);
      if (preserveScroll) window.scrollTo(0, scrollY);
    }
  };

  const fetchLogsOnly = async ({ preserveScroll = false } = {}) => {
    const scrollY = preserveScroll ? window.scrollY : 0;
    setError(null);
    try {
      const logsRes = await api.get('/admin/ocr-logs', { params: { limit: 50 } });
      setLogs(logsRes.data?.logs || []);
      setLastLogsRefreshAt(Date.now());
    } catch (err) {
      console.error('Admin logs error:', err);
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to refresh OCR logs.';
      setError(message);
    } finally {
      if (preserveScroll) window.scrollTo(0, scrollY);
    }
  };

  useEffect(() => {
    fetchOverviewAndLogs({ showLoading: true });
  }, []);

  // Refetch counts and logs when real-time events fire (report uploaded / analysis done)
  useEffect(() => {
    const handler = () => {
      // Debounce to avoid multiple rapid re-renders (and visible scroll jumps)
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        // Logs should update fast; the overview endpoint does a full log-file count
        fetchLogsOnly({ preserveScroll: true });
      }, 200);
    };
    window.addEventListener('hmh:adminRefresh', handler);
    return () => {
      window.removeEventListener('hmh:adminRefresh', handler);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const statCards = overview
    ? [
        { label: 'Total Users', value: overview.totalUsers, icon: 'fas fa-users' },
        { label: 'Patients', value: overview.patientUsers, icon: 'fas fa-user-injured' },
        { label: 'Total Reports', value: overview.totalReports, icon: 'fas fa-file-medical-alt' },
        { label: 'OCR Errors (logged)', value: overview.totalOcrErrors, icon: 'fas fa-exclamation-triangle' }
      ]
    : [];

  return (
    <div
      className="min-h-screen p-4 sm:p-6 md:p-8 relative overflow-x-clip"
      style={{
        background:
          'linear-gradient(180deg, #fff5f5 0%, #ffe0e0 10%, #ffcccc 20%, #ffb3b3 35%, #ff9999 50%, #ff8080 65%, #e06666 80%, #cc4d4d 90%, #b33b3b 100%)',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header — aligned with user Dashboard */}
        <div className="text-center sm:text-left animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
              <div className="flex justify-center sm:justify-start gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-[#8B0000] to-[#B22222] rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/40">
                  <i className="fas fa-tools text-2xl text-white"></i>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-[#B22222] to-[#CD5C5C] rounded-2xl flex items-center justify-center shadow-xl shadow-red-900/40 hidden sm:flex">
                  <i className="fas fa-shield-alt text-2xl text-white"></i>
                </div>
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <h1
                  className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#2c1212] mb-2"
                  style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 2px 4px rgba(0,0,0,0.08)' }}
                >
                  Admin Dashboard
                </h1>
                <p className="text-[#4e2a2a] text-base sm:text-lg font-medium max-w-2xl">
                  Monitor system usage, recent activity, and OCR failures. Admins do not upload reports here.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 self-center sm:self-start bg-gradient-to-r from-[#8B0000] to-[#B22222] hover:from-[#B22222] hover:to-[#DC143C] text-white shadow-lg shadow-red-900/40 hover:shadow-red-900/60 border-0 rounded-xl px-5 py-2.5 transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
              onClick={async () => {
                const scrollY = window.scrollY;
                setRefreshing(true);
                setError(null);
                try {
                  await fetchOverviewAndLogs({ showLoading: false, preserveScroll: true });
                } finally {
                  setRefreshing(false);
                  window.scrollTo(0, scrollY);
                }
              }}
              disabled={refreshing}
            >
              <i className={`mr-2 ${refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'}`}></i>
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded-lg text-red-700 text-sm flex items-start gap-2 shadow-sm">
            <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/80 animate-pulse shadow-lg"
                />
              ))}
            </div>
            <div className="h-80 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/80 animate-pulse shadow-xl" />
          </div>
        ) : (
          <>
            {overview && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((item) => (
                  <Card
                    key={item.label}
                    className="group relative overflow-hidden shadow-2xl shadow-red-900/20 border-0 bg-white/95 backdrop-blur-sm hover:shadow-red-900/35 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B0000] to-[#FF6B6B]"></div>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="text-sm font-semibold text-[#4e2a2a]">{item.label}</span>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B0000] to-[#B22222] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                          <i className={`${item.icon} text-white text-sm`}></i>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-[#2c1212]">{item.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="shadow-2xl shadow-red-900/25 border-0 overflow-hidden transform transition-all duration-500 hover:shadow-red-900/35 max-w-full">
              <div className="bg-gradient-to-r from-[#8B0000] to-[#B22222] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                <CardHeader className="pb-2 relative z-10 p-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-xl sm:text-2xl text-white flex items-center gap-2">
                        <i className="fas fa-bug"></i>
                        Recent OCR Errors
                      </CardTitle>
                      <CardDescription className="text-white/90 mt-1">
                        Inspect failed OCR uploads to improve parsers and handle edge cases.
                      </CardDescription>
                      {lastLogsRefreshAt && (
                        <div className="text-xs text-white/75 mt-2">
                          Updated: {new Date(lastLogsRefreshAt).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </div>

              <CardContent className="p-6 bg-white/80 backdrop-blur-sm">
                {logs.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-xl bg-gradient-to-br from-green-50/90 to-white/80 border border-green-100">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                      <i className="fas fa-check-circle text-3xl text-white"></i>
                    </div>
                    <p className="text-[#2c1212] font-semibold">No OCR errors logged</p>
                    <p className="text-sm text-[#4e2a2a] mt-1">Failed uploads will appear here for review.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border-2 border-gray-100 shadow-inner bg-white/90">
                    <table className="w-full text-sm border-collapse min-w-[640px]">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#FFE4E1] to-[#fff5f5] border-b-2 border-[#FFD1CF]">
                          <th className="px-4 py-3 text-left font-semibold text-[#8B0000]">Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-[#8B0000]">Type</th>
                          <th className="px-4 py-3 text-left font-semibold text-[#8B0000]">Filename</th>
                          <th className="px-4 py-3 text-left font-semibold text-[#8B0000]">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log, index) => (
                          <tr
                            key={`${log.timestamp}-${index}`}
                            className={`border-b border-gray-100 transition-colors hover:bg-[#fff8f8] ${
                              index % 2 === 0 ? 'bg-white' : 'bg-[#fffafa]'
                            }`}
                          >
                            <td className="px-4 py-3 align-top text-[#2c1212] font-medium">
                              {formatDateTime(log.timestamp)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                {log.type || 'ocr_error'}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top text-[#2c1212]">
                              {log.filename || 'unknown'}
                            </td>
                            <td className="px-4 py-3 align-top text-[#4e2a2a] max-w-xl">
                              {log.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;

