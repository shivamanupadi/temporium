import { Injectable, Logger } from '@nestjs/common';
import { DockerService } from '../docker/docker.service';
import { LogEntry, LogLevel, LogQuery } from '#types/index';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private dockerService: DockerService) {}

  async getLogs(query: LogQuery): Promise<LogEntry[]> {
    const { limit = 100 } = query;

    try {
      const rawLogs = await this.dockerService.getLogs(limit);
      return this.parseLogs(rawLogs);
    } catch (error) {
      this.logger.error('Failed to get logs:', error);
      return [];
    }
  }

  private parseLogs(rawLogs: string): LogEntry[] {
    const lines = rawLogs.split('\n').filter(line => line.trim());
    return lines.map(line => this.parseLogLine(line));
  }

  private parseLogLine(line: string): LogEntry {
    // Docker logs format: timestamp message
    // Example: 2024-01-15T10:30:00.123456789Z INFO [module] message

    // Try to extract timestamp at the beginning
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?)\s*/);
    let timestamp = new Date().toISOString();
    let message = line;

    if (timestampMatch) {
      timestamp = timestampMatch[1];
      message = line.slice(timestampMatch[0].length);
    }

    // Detect log level
    const level = this.detectLogLevel(message);

    // Extract source if present (e.g., [module])
    const sourceMatch = message.match(/^\[([^\]]+)\]\s*/);
    let source: string | undefined;
    if (sourceMatch) {
      source = sourceMatch[1];
      message = message.slice(sourceMatch[0].length);
    }

    return {
      timestamp,
      level,
      message: message.trim(),
      source,
    };
  }

  private detectLogLevel(message: string): LogLevel {
    const upperMessage = message.toUpperCase();

    if (
      upperMessage.includes('ERROR') ||
      upperMessage.includes('FATAL') ||
      upperMessage.includes('PANIC')
    ) {
      return 'error';
    }
    if (upperMessage.includes('WARN')) {
      return 'warn';
    }
    if (upperMessage.includes('DEBUG') || upperMessage.includes('TRACE')) {
      return 'debug';
    }
    return 'info';
  }

  async streamLogs(
    onLog: (entry: LogEntry) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    return this.dockerService.streamLogs((rawLog: string) => {
      const entry = this.parseLogLine(rawLog);
      onLog(entry);
    }, onError);
  }
}
