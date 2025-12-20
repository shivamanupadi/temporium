/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Single log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}

/**
 * Log query parameters
 */
export interface LogQuery {
  limit?: number;
  since?: string;
  until?: string;
  level?: LogLevel;
  search?: string;
}

/**
 * WebSocket log message types
 */
export type LogMessageType = 'log' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket log message
 */
export interface LogMessage {
  type: LogMessageType;
  data?: LogEntry;
  error?: string;
}
