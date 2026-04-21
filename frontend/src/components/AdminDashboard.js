import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#fff8f8] to-[#FFE4E1] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#8B0000] mb-1">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Monitor system usage, recent activity, and OCR failures. Admins do not upload reports here.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-auto"
            onClick={async () => {
              const scrollY = window.scrollY;
              setRefreshing(true);
              setError(null);
              try {
                await fetchOverviewAndLogs({ showLoading: false, preserveScroll: true });
              } finally {
                setRefreshing(false);
                // Ensure we restore scroll even if fetchData errors.
                window.scrollTo(0, scrollY);
              }
            }}
            disabled={refreshing}
          >
            <i className={`mr-2 ${refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'}`}></i>
            Refresh
          </Button>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <i className="fas fa-exclamation-circle text-red-600 mt-1"></i>
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="skeleton-card" style={{ height: '120px' }}></div>
            <div className="skeleton-card" style={{ height: '320px' }}></div>
          </div>
        ) : (
          <>
            {/* Overview cards */}
            {overview && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Total Users</span>
                      <i className="fas fa-users text-[#8B0000]"></i>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.totalUsers}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Patients</span>
                      <i className="fas fa-user-injured text-[#8B0000]"></i>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.patientUsers}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Total Reports</span>
                      <i className="fas fa-file-medical-alt text-[#8B0000]"></i>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.totalReports}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">OCR Errors (logged)</span>
                      <i className="fas fa-exclamation-triangle text-[#8B0000]"></i>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {overview.totalOcrErrors}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* OCR error logs */}
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <i className="fas fa-bug text-[#8B0000]"></i>
                      Recent OCR Errors
                    </CardTitle>
                    <CardDescription>
                      Inspect failed OCR uploads to improve parsers and handle edge cases.
                    </CardDescription>
                    {lastLogsRefreshAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        Updated: {new Date(lastLogsRefreshAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <i className="fas fa-check-circle text-3xl text-green-500 mb-2"></i>
                    <p>No OCR errors have been logged yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Filename</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log, index) => (
                          <tr
                            key={`${log.timestamp}-${index}`}
                            className={`border-b border-gray-100 ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                          >
                            <td className="px-3 py-2 align-top text-gray-800">
                              {formatDateTime(log.timestamp)}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {log.type || 'ocr_error'}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-top text-gray-800">
                              {log.filename || 'unknown'}
                            </td>
                            <td className="px-3 py-2 align-top text-gray-700 max-w-xl">
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
    </div>
  );
};

export default AdminDashboard;

