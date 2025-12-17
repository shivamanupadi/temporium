import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, type JSX } from 'react';
import { io, Socket } from 'socket.io-client';
import { logsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">Real-time container logs</p>
        </div>
      </div>

      <Card className="flex flex-col h-[calc(100vh-200px)]">
        <CardHeader className="flex-shrink-0 flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Container Logs
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsLive(!isLive)}>
              {isLive ? (
                <>
                  <Pause className="w-4 h-4 mr-1" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" /> Resume
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div
            ref={scrollRef}
            className="h-full overflow-auto font-mono text-xs bg-slate-950 text-slate-100 p-4"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                No logs available
              </div>
            ) : (
              filteredLogs.map((log, index) => <LogLine key={index} log={log} />)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogLine({ log }: { log: LogEntry }): JSX.Element {
  const levelColors = {
    debug: 'text-slate-400',
    info: 'text-blue-400',
    warn: 'text-yellow-400',
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
      {log.source && <span className="text-purple-400 flex-shrink-0">[{log.source}]</span>}
      <span className="text-slate-200 break-all">{log.message}</span>
    </div>
  );
}
