# Tempo Node Manager

A self-hosted web dashboard for managing Tempo blockchain nodes via Docker.

## Features

- **Admin Authentication** - Secure login with bcrypt-hashed passwords
- **Node Control** - Start, stop, restart your Tempo node
- **Real-time Logs** - WebSocket-powered live log streaming
- **System Metrics** - CPU, RAM, disk, and network monitoring
- **Sync Status** - Track blockchain sync progress
- **Snapshot Management** - Download snapshots for faster sync

## Architecture

```
┌─────────────────────────────────────────┐
│         Tempo Node Manager              │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │  NestJS API │  │   React Web UI  │   │
│  │  /api/*     │  │   (served at /) │   │
│  └──────┬──────┘  └─────────────────┘   │
│         │                               │
│         │ Docker API                    │
│         ▼                               │
│  ┌─────────────────────────────────┐   │
│  │    Tempo Docker Container       │   │
│  │    ghcr.io/tempoxyz/tempo       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 20+
- Yarn
- Docker

### Setup

```bash
# From the monorepo root
yarn install

# Start development servers
cd apps/tempo-node-manager
yarn dev
```

This starts:
- Agent (NestJS) on http://localhost:9545
- Web UI (Vite) on http://localhost:3002 (proxies API to agent)

### Build

```bash
# Build both agent and web
yarn build

# The agent serves the web UI from web/dist
```

## Production Deployment

### One-Line Install (Linux/macOS)

```bash
curl -sSL https://your-domain.com/install | bash
```

### Manual Installation

1. **Build the project:**
   ```bash
   yarn build
   ```

2. **Copy files to server:**
   ```bash
   scp -r apps/tempo-node-manager/agent/dist user@server:/opt/tempo-node-manager/
   scp -r apps/tempo-node-manager/web/dist user@server:/opt/tempo-node-manager/web/
   ```

3. **Create environment file:**
   ```bash
   cat > /etc/tempo-node-manager/.env << EOF
   PORT=9545
   JWT_SECRET=$(openssl rand -hex 32)
   CONFIG_PATH=/etc/tempo-node-manager/config.json
   TEMPO_DATA_DIR=/var/lib/tempo
   EOF
   ```

4. **Create systemd service:**
   ```bash
   # See scripts/install.sh for full systemd service file
   ```

5. **Start the service:**
   ```bash
   sudo systemctl start tempo-node-manager
   ```

6. **Access the dashboard:**
   Open `http://your-server-ip:9545` and set your admin password.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/status` | GET | Check setup status |
| `/api/auth/setup` | POST | Initial password setup |
| `/api/auth/login` | POST | Login with password |
| `/api/node/status` | GET | Get node status |
| `/api/node/start` | POST | Start the node |
| `/api/node/stop` | POST | Stop the node |
| `/api/node/restart` | POST | Restart the node |
| `/api/logs` | GET | Get recent logs |
| `/api/metrics` | GET | Get system metrics |
| `/api/snapshots` | GET | List available snapshots |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 9545 | Agent HTTP port |
| `JWT_SECRET` | - | Secret for JWT tokens |
| `CONFIG_PATH` | /etc/tempo-node-manager/config.json | Admin config location |
| `TEMPO_VERSION` | 0.7.2 | Tempo Docker image version |
| `TEMPO_DATA_DIR` | /var/lib/tempo | Blockchain data directory |
| `TEMPO_HTTP_PORT` | 8545 | Tempo RPC port |
| `TEMPO_P2P_PORT` | 30303 | Tempo P2P port |

## License

Private - Temporium
