import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, type JSX } from 'react';
import { io, Socket } from 'socket.io-client';
import { logsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollText, Search, Pause, Play, Trash2 } from 'lucide-react';
import type { LogEntry, LogMessage } from '#types/index';

export const Route = createFileRoute('/portal/logs')({
  component: LogsPage,
});

function LogsPage(): JSX.Element {
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initial logs fetch
  const { data: initialLogs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => logsApi.getLogs(200),
  });

  useEffect(() => {
    if (initialLogs) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  // WebSocket connection for live logs
  useEffect(() => {
    if (!isLive || !token) return;

    // Support remote agent via VITE_API_URL env var
    const wsBase = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : '';
    const socket = io(`${wsBase}/logs`, {
      query: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe');
    });

    socket.on('log', (message: LogMessage) => {
      if (message.type === 'log' && message.data) {
        setLogs(prev => [...prev.slice(-499), message.data!]);
      }
    });

    return () => {
      socket.emit('unsubscribe');
      socket.disconnect();
    };
  }, [isLive, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isLive) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isLive]);

  const filteredLogs = search
    ? logs.filter(
        log =>
          log.message.toLowerCase().includes(search.toLowerCase()) ||
          log.source?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const clearLogs = (): void => setLogs([]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Logs</h1>
          <p className="text-[12px] sm:text-[13px] text-slate-500 mt-0.5">
            Real-time container logs
          </p>
        </div>
      </div>

      {/* Logs Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-200px)] sm:h-[calc(100vh-220px)]">
        {/* Header */}
        <div
          className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0"
          style={{ backgroundColor: '#f2f2f2' }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#E0E7FF' }}
            >
              <ScrollText className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#7c5cff' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] sm:text-sm font-semibold text-slate-800">
                Container Logs
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                {filteredLogs.length} entries
              </p>
            </div>
            {isLive && (
              <span
                className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shrink-0"
                style={{ backgroundColor: '#D1FAE5', color: '#059669' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: '#059669' }}
                />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter logs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 sm:h-9 w-full sm:w-48 md:w-64 text-[13px] sm:text-sm bg-white border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              />
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className={cn(
                'h-8 sm:h-9 px-2 sm:px-3 text-[12px] sm:text-[13px] rounded-lg shrink-0',
                isLive
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
              )}
            >
              {isLive ? (
                <>
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="h-8 sm:h-9 px-2 sm:px-3 text-[12px] sm:text-[13px] text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>

        {/* Log Content - Light Theme */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto font-mono text-[11px] sm:text-[12px] bg-white p-2 sm:p-4"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <ScrollText className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No logs available</p>
              <p className="text-xs mt-1">Logs will appear here when the node is running</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, index) => (
                <LogLine key={index} log={log} search={search} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogLine({ log, search }: { log: LogEntry; search: string }): JSX.Element {
  const levelConfig = {
    debug: { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
    info: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    warn: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    error: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  };

  const config = levelConfig[log.level] || levelConfig.info;

  // Highlight search matches
  const highlightText = (text: string): JSX.Element => {
    if (!search) return <>{text}</>;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-900 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="flex items-start gap-1.5 sm:gap-3 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-md hover:bg-slate-50 transition-colors group">
      <span className="text-[9px] sm:text-[11px] text-slate-400 font-medium flex-shrink-0 tabular-nums pt-0.5 hidden xs:inline">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span
        className={cn(
          'text-[8px] sm:text-[10px] uppercase font-semibold px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0',
          config.bg,
          config.color,
          'border',
          config.border
        )}
      >
        {log.level}
      </span>
      {log.source && (
        <span className="text-[9px] sm:text-[11px] text-violet-600 font-medium flex-shrink-0 bg-violet-50 px-1 sm:px-1.5 py-0.5 rounded border border-violet-100 hidden sm:inline">
          {log.source}
        </span>
      )}
      <span className="text-slate-700 break-all leading-relaxed min-w-0">
        {highlightText(log.message)}
      </span>
    </div>
  );
}
