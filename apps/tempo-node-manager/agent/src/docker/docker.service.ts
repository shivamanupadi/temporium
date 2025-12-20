import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import {
  NodeStatus,
  NodeConfig,
  TEMPO_IMAGE,
  CONTAINER_NAME,
  DEFAULT_NODE_CONFIG,
  TEMPO_BOOTNODES,
} from '#types/index';

@Injectable()
export class DockerService implements OnModuleInit {
  private readonly logger = new Logger(DockerService.name);
  private docker: Docker;
  private config: NodeConfig;
  private externalIp: string | null = null;

  constructor(private configService: ConfigService) {
    this.docker = new Docker();
    this.config = {
      ...DEFAULT_NODE_CONFIG,
      version: this.configService.get('TEMPO_VERSION', DEFAULT_NODE_CONFIG.version),
      dataDir: this.configService.get('TEMPO_DATA_DIR', DEFAULT_NODE_CONFIG.dataDir),
      httpPort: this.configService.get('TEMPO_HTTP_PORT', DEFAULT_NODE_CONFIG.httpPort),
      wsPort: this.configService.get('TEMPO_WS_PORT', DEFAULT_NODE_CONFIG.wsPort),
      p2pPort: this.configService.get('TEMPO_P2P_PORT', DEFAULT_NODE_CONFIG.p2pPort),
    };
  }

  private async detectExternalIp(): Promise<string | null> {
    try {
      const response = await fetch('https://ifconfig.me/ip');
      if (response.ok) {
        const ip = (await response.text()).trim();
        this.logger.log(`Detected external IP: ${ip}`);
        return ip;
      }
    } catch (error) {
      this.logger.warn('Failed to detect external IP:', error);
    }
    return null;
  }

  async onModuleInit() {
    try {
      const info = await this.docker.info();
      this.logger.log(`Docker connected: ${info.Name}`);

      // Detect external IP for NAT configuration
      this.externalIp = await this.detectExternalIp();
    } catch (error) {
      this.logger.error('Failed to connect to Docker:', error);
      throw new Error('Docker is not available. Please ensure Docker is running.');
    }
  }

  getConfig(): NodeConfig {
    return this.config;
  }

  getImageName(): string {
    return `${TEMPO_IMAGE}:${this.config.version}`;
  }

  async getStatus(): Promise<NodeStatus> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();

      if (info.State.Running) {
        return 'running';
      } else if (info.State.Restarting) {
        return 'starting';
      } else {
        return 'stopped';
      }
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return 'not_installed';
      }
      this.logger.error('Error getting container status:', error);
      return 'error';
    }
  }

  async getContainerId(): Promise<string | undefined> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();
      return info.Id;
    } catch {
      return undefined;
    }
  }

  async getContainerStartTime(): Promise<string | undefined> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const info = await container.inspect();
      return info.State.StartedAt;
    } catch {
      return undefined;
    }
  }

  async getImageVersion(): Promise<string | undefined> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const containerInfo = await container.inspect();

      // Try to get version from container labels first
      const labels = containerInfo.Config.Labels || {};
      if (labels['org.opencontainers.image.version']) {
        return labels['org.opencontainers.image.version'];
      }

      // Try to get version by running tempo --version in the container
      if (containerInfo.State.Running) {
        try {
          const exec = await container.exec({
            Cmd: ['tempo', '--version'],
            AttachStdout: true,
            AttachStderr: true,
          });
          const stream = await exec.start({ Detach: false });
          const output = await this.streamToString(stream);
          this.logger.debug(`tempo --version output: ${output}`);

          // Try multiple patterns to extract version
          // Pattern 1: "tempo 0.1.0" or "tempo version 0.1.0" or "reth 0.1.0"
          let versionMatch = output.match(
            /(?:tempo|reth|version)\s+v?([\d]+\.[\d]+\.[\d]+[-\w]*)/i
          );
          if (versionMatch) {
            return versionMatch[1];
          }

          // Pattern 2: Any semver-like version in the output
          versionMatch = output.match(/v?([\d]+\.[\d]+\.[\d]+[-\w]*)/);
          if (versionMatch) {
            return versionMatch[1];
          }
        } catch (error) {
          this.logger.debug(`Failed to get version from tempo --version: ${error}`);
        }
      }

      // Fallback: get from image tags
      const imageId = containerInfo.Image;
      const image = this.docker.getImage(imageId);
      const imageInfo = await image.inspect();

      // Check image labels
      const imageLabels = imageInfo.Config?.Labels || {};
      if (imageLabels['org.opencontainers.image.version']) {
        return imageLabels['org.opencontainers.image.version'];
      }

      // Look for a tag that matches our tempo image
      const repoTags = imageInfo.RepoTags || [];
      const tempoTag = repoTags.find((tag: string) => tag.startsWith(TEMPO_IMAGE));

      if (tempoTag) {
        const version = tempoTag.split(':')[1];
        // Only return if it's not "latest"
        if (version && version !== 'latest') {
          return version;
        }
      }

      // Last fallback: return short image ID
      return imageId.replace('sha256:', '').slice(0, 12);
    } catch {
      return undefined;
    }
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }

  async pullImage(): Promise<void> {
    const imageName = this.getImageName();
    this.logger.log(`Pulling image: ${imageName}`);

    return new Promise((resolve, reject) => {
      // Use linux/amd64 platform for compatibility (Tempo doesn't have ARM64 builds)
      this.docker.pull(
        imageName,
        { platform: 'linux/amd64' },
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }

          this.docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              this.logger.log(`Image pulled: ${imageName}`);
              resolve();
            }
          });
        }
      );
    });
  }

  async createContainer(): Promise<string> {
    const imageName = this.getImageName();

    // Ensure image exists
    try {
      await this.docker.getImage(imageName).inspect();
    } catch {
      await this.pullImage();
    }

    // Build command with optional NAT configuration
    const cmd = [
      'node',
      '--datadir',
      '/root/.tempo',
      '--follow',
      // P2P networking
      '--port',
      this.config.p2pPort.toString(),
      '--discovery.addr',
      '0.0.0.0',
      '--discovery.port',
      this.config.p2pPort.toString(),
      // Bootnodes for peer discovery
      '--bootnodes',
      TEMPO_BOOTNODES.join(','),
      // HTTP RPC
      '--http',
      '--http.addr',
      '0.0.0.0',
      '--http.port',
      this.config.httpPort.toString(),
      '--http.api',
      this.config.httpApis.join(','),
      // WebSocket RPC
      '--ws',
      '--ws.addr',
      '0.0.0.0',
      '--ws.port',
      this.config.wsPort.toString(),
      '--ws.api',
      this.config.httpApis.join(','),
    ];

    // Add NAT configuration if external IP is available
    if (this.externalIp) {
      cmd.push('--nat', `extip:${this.externalIp}`);
      this.logger.log(`Using external IP for NAT: ${this.externalIp}`);
    }

    const container = await this.docker.createContainer({
      Image: imageName,
      name: CONTAINER_NAME,
      platform: 'linux/amd64', // Tempo doesn't have ARM64 builds
      Cmd: cmd,
      ExposedPorts: {
        [`${this.config.httpPort}/tcp`]: {},
        [`${this.config.wsPort}/tcp`]: {},
        [`${this.config.p2pPort}/tcp`]: {},
        [`${this.config.p2pPort}/udp`]: {},
      },
      HostConfig: {
        PortBindings: {
          [`${this.config.httpPort}/tcp`]: [{ HostPort: this.config.httpPort.toString() }],
          [`${this.config.wsPort}/tcp`]: [{ HostPort: this.config.wsPort.toString() }],
          [`${this.config.p2pPort}/tcp`]: [{ HostPort: this.config.p2pPort.toString() }],
          [`${this.config.p2pPort}/udp`]: [{ HostPort: this.config.p2pPort.toString() }],
        },
        Binds: [`${this.config.dataDir}:/root/.tempo`],
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });

    this.logger.log(`Container created: ${container.id}`);
    return container.id;
  }

  async startContainer(): Promise<void> {
    const status = await this.getStatus();

    if (status === 'not_installed') {
      await this.createContainer();
    }

    const container = this.docker.getContainer(CONTAINER_NAME);
    await container.start();
    this.logger.log('Container started');
  }

  async stopContainer(): Promise<void> {
    const container = this.docker.getContainer(CONTAINER_NAME);
    await container.stop();
    this.logger.log('Container stopped');
  }

  async restartContainer(): Promise<void> {
    const container = this.docker.getContainer(CONTAINER_NAME);
    await container.restart();
    this.logger.log('Container restarted');
  }

  async removeContainer(): Promise<void> {
    const container = this.docker.getContainer(CONTAINER_NAME);
    await container.remove({ force: true });
    this.logger.log('Container removed');
  }

  async getLogs(tail: number = 100): Promise<string> {
    const container = this.docker.getContainer(CONTAINER_NAME);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return logs.toString();
  }

  async streamLogs(
    onData: (log: string) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const container = this.docker.getContainer(CONTAINER_NAME);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      timestamps: true,
      since: Math.floor(Date.now() / 1000),
    });

    stream.on('data', (chunk: Buffer) => {
      // Docker logs have an 8-byte header, skip it
      const data = chunk.slice(8).toString();
      if (data.trim()) {
        onData(data);
      }
    });

    stream.on('error', onError);

    return () => {
      (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    };
  }

  async getContainerStats(): Promise<Docker.ContainerStats | null> {
    try {
      const container = this.docker.getContainer(CONTAINER_NAME);
      const stats = await container.stats({ stream: false });
      return stats;
    } catch {
      return null;
    }
  }

  async runDownloadCommand(onProgress?: (logLine: string) => void): Promise<string> {
    const imageName = this.getImageName();
    this.logger.log(`Running tempo download command with image: ${imageName}`);

    // Ensure image exists
    try {
      await this.docker.getImage(imageName).inspect();
    } catch {
      await this.pullImage();
    }

    // Remove existing download container if exists
    try {
      const existingContainer = this.docker.getContainer('tempo-snapshot-download');
      await existingContainer.remove({ force: true });
    } catch {
      // Container doesn't exist, ignore
    }

    // Run download in a temporary container with the data volume mounted
    const container = await this.docker.createContainer({
      Image: imageName,
      name: 'tempo-snapshot-download',
      platform: 'linux/amd64',
      Cmd: ['download', '--datadir', '/root/.tempo'],
      HostConfig: {
        Binds: [`${this.config.dataDir}:/root/.tempo`],
        AutoRemove: true,
      },
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    this.logger.log('Starting snapshot download container...');

    return new Promise((resolve, reject) => {
      container.attach({ stream: true, stdout: true, stderr: true }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';

        stream?.on('data', (chunk: Buffer) => {
          // Docker multiplexed stream format: 8-byte header + data
          const data = chunk.slice(8).toString().trim();
          if (data) {
            output += data + '\n';
            this.logger.log(`[download] ${data}`);
            if (onProgress) {
              onProgress(data);
            }
          }
        });

        container.start(startErr => {
          if (startErr) {
            reject(startErr);
            return;
          }

          container.wait((waitErr, result) => {
            if (waitErr) {
              reject(waitErr);
              return;
            }

            if (result.StatusCode !== 0) {
              reject(new Error(`Download failed with exit code ${result.StatusCode}: ${output}`));
            } else {
              this.logger.log('Snapshot download completed successfully');
              resolve('Snapshot downloaded successfully');
            }
          });
        });
      });
    });
  }
}
