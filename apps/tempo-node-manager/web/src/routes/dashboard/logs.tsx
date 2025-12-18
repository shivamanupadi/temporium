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

export const Route = createFileRoute('/dashboard/logs')({
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

    const socket = io('/logs', {
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Logs</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Real-time container logs</p>
        </div>
      </div>

      {/* Logs Card */}
      <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col h-[calc(100vh-220px)]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-slate-500" />
            <h2 className="text-[13px] font-semibold text-gray-900">Container Logs</h2>
            {isLive && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 w-56 text-[13px] bg-gray-50 border-gray-200"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className="h-8 text-[12px] border-gray-200"
            >
              {isLive ? (
                <>
                  <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1" /> Resume
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLogs}
              className="h-8 text-[12px] border-gray-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>

        {/* Log Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto font-mono text-[12px] bg-slate-950 text-slate-100 p-4"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              No logs available
            </div>
          ) : (
            filteredLogs.map((log, index) => <LogLine key={index} log={log} />)
          )}
        </div>
      </div>
    </div>
  );
}

function LogLine({ log }: { log: LogEntry }): JSX.Element {
  const levelColors = {
    debug: 'text-slate-400',
    info: 'text-blue-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
  };

  return (
    <div className="flex gap-2 py-0.5 hover:bg-slate-900/50">
      <span className="text-slate-500 flex-shrink-0">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span className={cn('uppercase w-12 flex-shrink-0', levelColors[log.level])}>
        {log.level}
      </span>
      {log.source && <span className="text-violet-400 flex-shrink-0">[{log.source}]</span>}
      <span className="text-slate-200 break-all">{log.message}</span>
    </div>
  );
}
