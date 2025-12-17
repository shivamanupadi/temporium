import { Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';

export interface MonitoringStatus {
  prometheusRunning: boolean;
  grafanaRunning: boolean;
  prometheusUrl: string;
  grafanaUrl: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async getStatus(): Promise<MonitoringStatus> {
    const [prometheusRunning, grafanaRunning] = await Promise.all([
      this.isContainerRunning('tempo-prometheus'),
      this.isContainerRunning('tempo-grafana'),
    ]);

    return {
      prometheusRunning,
      grafanaRunning,
      prometheusUrl: 'http://localhost:9090',
      grafanaUrl: 'http://localhost:3000',
    };
  }

  private async isContainerRunning(name: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(name);
      const info = await container.inspect();
      return info.State.Running;
    } catch {
      return false;
    }
  }

  async startMonitoring(): Promise<{ success: boolean; message: string }> {
    try {
      // Pull images if needed
      await this.ensureImage('prom/prometheus:latest');
      await this.ensureImage('grafana/grafana:latest');

      // Start Prometheus
      await this.startPrometheus();

      // Start Grafana
      await this.startGrafana();

      return { success: true, message: 'Monitoring stack started' };
    } catch (error) {
      this.logger.error('Failed to start monitoring:', error);
      return { success: false, message: `Failed to start: ${error}` };
    }
  }

  async stopMonitoring(): Promise<{ success: boolean; message: string }> {
    try {
      await this.stopContainer('tempo-grafana');
      await this.stopContainer('tempo-prometheus');
      return { success: true, message: 'Monitoring stack stopped' };
    } catch (error) {
      this.logger.error('Failed to stop monitoring:', error);
      return { success: false, message: `Failed to stop: ${error}` };
    }
  }

  private async ensureImage(imageName: string): Promise<void> {
    try {
      await this.docker.getImage(imageName).inspect();
    } catch {
      this.logger.log(`Pulling image: ${imageName}`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, {}, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }
          this.docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    }
  }

  private async startPrometheus(): Promise<void> {
    const name = 'tempo-prometheus';

    // Remove existing container if exists
    try {
      const existing = this.docker.getContainer(name);
      await existing.remove({ force: true });
    } catch {
      // Container doesn't exist
    }

    // Create and start container
    const container = await this.docker.createContainer({
      Image: 'prom/prometheus:latest',
      name,
      ExposedPorts: { '9090/tcp': {} },
      HostConfig: {
        PortBindings: { '9090/tcp': [{ HostPort: '9090' }] },
        RestartPolicy: { Name: 'unless-stopped' },
        ExtraHosts: ['host.docker.internal:host-gateway'],
      },
      Cmd: [
        '--config.file=/etc/prometheus/prometheus.yml',
        '--storage.tsdb.path=/prometheus',
        '--storage.tsdb.retention.time=30d',
        '--web.enable-lifecycle',
      ],
    });

    await container.start();
    this.logger.log('Prometheus started');
  }

  private async startGrafana(): Promise<void> {
    const name = 'tempo-grafana';

    // Remove existing container if exists
    try {
      const existing = this.docker.getContainer(name);
      await existing.remove({ force: true });
    } catch {
      // Container doesn't exist
    }

    // Create and start container
    const container = await this.docker.createContainer({
      Image: 'grafana/grafana:latest',
      name,
      ExposedPorts: { '3000/tcp': {} },
      Env: [
        'GF_SECURITY_ADMIN_USER=admin',
        'GF_SECURITY_ADMIN_PASSWORD=admin',
        'GF_USERS_ALLOW_SIGN_UP=false',
      ],
      HostConfig: {
        PortBindings: { '3000/tcp': [{ HostPort: '3000' }] },
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });

    await container.start();
    this.logger.log('Grafana started');
  }

  private async stopContainer(name: string): Promise<void> {
    try {
      const container = this.docker.getContainer(name);
      await container.stop();
      await container.remove();
      this.logger.log(`${name} stopped`);
    } catch {
      // Container doesn't exist or already stopped
    }
  }
}
