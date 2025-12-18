import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface ReleaseInfo {
  version: string;
  tag: string;
  checksum: string;
  filename: string;
  releaseDate: string;
  downloadUrl: string;
  releaseNotes: string;
}

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checksum: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  lastChecked: string;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  newVersion?: string;
}

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private readonly releasesUrl: string;
  private readonly currentVersion: string;
  private cachedReleaseInfo: ReleaseInfo | null = null;
  private lastChecked: Date | null = null;
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private configService: ConfigService) {
    this.releasesUrl = this.configService.get(
      'RELEASES_URL',
      'https://cdn.temporium.xyz/node-manager/releases'
    );

    // Read current version from package.json
    this.currentVersion = this.readCurrentVersion();
    this.logger.log(`Current version: ${this.currentVersion}`);
  }

  private readCurrentVersion(): string {
    try {
      // Try reading from package.json in the install directory
      const packageJsonPaths = [
        path.join(process.cwd(), 'package.json'),
        path.join(__dirname, '..', '..', 'package.json'),
        '/opt/tempo-node-manager/package.json',
      ];

      for (const pkgPath of packageJsonPaths) {
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.version) {
            return pkg.version;
          }
        }
      }
    } catch (error) {
      this.logger.warn('Could not read package.json version', error);
    }

    return '0.0.0';
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  async getVersionInfo(): Promise<VersionInfo> {
    const release = await this.fetchLatestRelease();

    return {
      current: this.currentVersion,
      latest: release?.version || null,
      updateAvailable: release ? this.isNewerVersion(release.version, this.currentVersion) : false,
      releaseUrl: release?.downloadUrl || null,
      checksum: release?.checksum || null,
      releaseDate: release?.releaseDate || null,
      releaseNotes: release?.releaseNotes || null,
      lastChecked: this.lastChecked?.toISOString() || new Date().toISOString(),
    };
  }

  async fetchLatestRelease(): Promise<ReleaseInfo | null> {
    // Return cached release if still valid
    if (this.cachedReleaseInfo && this.lastChecked) {
      const elapsed = Date.now() - this.lastChecked.getTime();
      if (elapsed < this.cacheTimeout) {
        return this.cachedReleaseInfo;
      }
    }

    try {
      // Fetch release.json from releases
      const releaseUrl = `${this.releasesUrl}/latest/release.json`;
      const response = await fetch(releaseUrl);

      if (!response.ok) {
        this.logger.warn(`Could not fetch release.json: ${response.status}`);
        return null;
      }

      const release: ReleaseInfo = await response.json();
      this.cachedReleaseInfo = release;
      this.lastChecked = new Date();

      this.logger.log(`Latest version: ${release.version}`);
      return release;
    } catch (error) {
      this.logger.error('Failed to fetch latest release:', error);
      return null;
    }
  }

  private isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (v: string) => {
      const clean = v.replace(/^v/, '');
      const parts = clean.split('.').map(Number);
      return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
    };

    const l = parseVersion(latest);
    const c = parseVersion(current);

    if (l.major > c.major) return true;
    if (l.major < c.major) return false;
    if (l.minor > c.minor) return true;
    if (l.minor < c.minor) return false;
    return l.patch > c.patch;
  }

  async performUpdate(): Promise<UpdateResult> {
    const versionInfo = await this.getVersionInfo();

    if (!versionInfo.updateAvailable) {
      return {
        success: false,
        message: 'Already on the latest version',
      };
    }

    if (!versionInfo.releaseUrl) {
      return {
        success: false,
        message: 'Could not determine release URL',
      };
    }

    try {
      this.logger.log(`Starting update to version ${versionInfo.latest}`);

      const installDir = process.cwd();
      const backupDir = `${installDir}.backup.${Date.now()}`;
      const tempDir = `/tmp/tempo-update-${Date.now()}`;

      // Create temp directory
      await execAsync(`mkdir -p ${tempDir}`);

      // Download new release
      this.logger.log('Downloading new release...');
      await execAsync(
        `curl -sSL "${versionInfo.releaseUrl}" -o ${tempDir}/tempo-node-manager.tar.gz`
      );

      // Extract to temp
      await execAsync(`tar -xzf ${tempDir}/tempo-node-manager.tar.gz -C ${tempDir}`);

      // Backup current installation
      this.logger.log('Creating backup...');
      await execAsync(`cp -r ${installDir} ${backupDir}`);

      // Install new files (remove old dist to avoid mixing old/new hashed files)
      this.logger.log('Installing new version...');
      // Use single command with sync to ensure deletion completes before copy
      await execAsync(
        `rm -rf ${installDir}/dist && sync && cp -r ${tempDir}/tempo-node-manager/dist ${installDir}/`
      );
      await execAsync(
        `cp -r ${tempDir}/tempo-node-manager/node_modules ${installDir}/ 2>/dev/null || true`
      );
      await execAsync(`cp -r ${tempDir}/tempo-node-manager/prisma ${installDir}/ 2>/dev/null || true`);

      // Update package.json version
      const pkgPath = path.join(installDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        pkg.version = versionInfo.latest;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      }

      // Run database migrations (source env file for DATABASE_URL)
      this.logger.log('Applying database migrations...');
      try {
        const envFile = '/etc/tempo-node-manager/.env';
        await execAsync(
          `bash -c 'cd ${installDir} && source ${envFile} 2>/dev/null && ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss'`
        );
        this.logger.log('Database migrations applied successfully');
      } catch (migrationError) {
        this.logger.warn('Database migration warning:', migrationError);
        // Continue anyway - prisma db push is generally safe
      }

      // Cleanup
      await execAsync(`rm -rf ${tempDir}`);

      this.logger.log(`Update to ${versionInfo.latest} completed successfully`);

      return {
        success: true,
        message: `Updated to version ${versionInfo.latest}. Please restart the service.`,
        newVersion: versionInfo.latest || undefined,
      };
    } catch (error) {
      this.logger.error('Update failed:', error);
      return {
        success: false,
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async restartService(): Promise<{ success: boolean; message: string }> {
    try {
      // Try systemctl without sudo first (when running as root)
      await execAsync('systemctl restart tempo-node-manager');
      return { success: true, message: 'Service restart initiated' };
    } catch {
      try {
        // Try with sudo (when running as non-root user)
        await execAsync('sudo systemctl restart tempo-node-manager');
        return { success: true, message: 'Service restart initiated' };
      } catch {
        try {
          // Try launchctl (macOS)
          await execAsync(
            'launchctl unload ~/Library/LaunchAgents/com.tempo.node-manager.plist && launchctl load ~/Library/LaunchAgents/com.tempo.node-manager.plist'
          );
          return { success: true, message: 'Service restart initiated' };
        } catch {
          return {
            success: false,
            message: 'Could not restart service automatically. Please restart manually.',
          };
        }
      }
    }
  }
}
