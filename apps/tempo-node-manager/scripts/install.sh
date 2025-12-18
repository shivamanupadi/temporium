#!/usr/bin/env bash
# Tempo Node Manager Installer
# One-line install: curl -sSL https://cdn.temporium.xyz/node-manager/releases/install.sh | bash
#
# Supports:
#   - Ubuntu/Debian (apt)
#   - CentOS/RHEL/Fedora (yum/dnf)
#   - Arch Linux (pacman)
#   - Alpine Linux (apk)
#   - openSUSE (zypper)
#   - macOS (brew)

set -e

# Configuration
# Downloads from Cloudflare R2 (fast, no egress fees)
DOWNLOAD_URL="${DOWNLOAD_URL:-https://cdn.temporium.xyz/node-manager/releases}"
RELEASE_VERSION="${RELEASE_VERSION:-latest}"
TEMPO_VERSION="${TEMPO_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/tempo-node-manager}"
DATA_DIR="${DATA_DIR:-/var/lib/tempo}"
CONFIG_DIR="${CONFIG_DIR:-/etc/tempo-node-manager}"
AGENT_PORT="${AGENT_PORT:-3003}"
HTTP_PORT="${HTTP_PORT:-8545}"
P2P_PORT="${P2P_PORT:-30303}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# System detection
OS=""
PKG_MANAGER=""
DISTRO=""
ARCH=""

print_banner() {
    echo -e "${BLUE}"
    echo "  _____                               _   _           _      "
    echo " |_   _|__ _ __ ___  _ __   ___      | \\ | | ___   __| | ___ "
    echo "   | |/ _ \\ '\`_ \` _ \\| '_ \\ / _ \\     |  \\| |/ _ \\ / _\` |/ _ \\"
    echo "   | |  __/ | | | | | |_) | (_) |    | |\\  | (_) | (_| |  __/"
    echo "   |_|\\___|_| |_| |_| .__/ \\___/     |_| \\_|\\___/ \\__,_|\\___|"
    echo "                    |_|                                       "
    echo -e "${NC}"
    echo -e "${BOLD}Tempo Node Manager - One-Click Installer${NC}"
    echo "=========================================="
    echo ""
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# Detect OS, distro, and architecture
detect_system() {
    log_step "Detecting System"

    # Detect architecture
    case "$(uname -m)" in
        x86_64|amd64) ARCH="amd64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        armv7l) ARCH="armv7" ;;
        *) log_error "Unsupported architecture: $(uname -m)"; exit 1 ;;
    esac

    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
        DISTRO="macOS $(sw_vers -productVersion)"
    elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "linux" ]]; then
        OS="linux"

        if [ -f /etc/os-release ]; then
            . /etc/os-release
            DISTRO="$NAME $VERSION_ID"

            case "$ID" in
                ubuntu|debian|linuxmint|pop|elementary|zorin|raspbian)
                    PKG_MANAGER="apt"
                    ;;
                centos|rhel|rocky|almalinux|oracle|amzn)
                    PKG_MANAGER=$(command -v dnf &>/dev/null && echo "dnf" || echo "yum")
                    ;;
                fedora)
                    PKG_MANAGER="dnf"
                    ;;
                arch|manjaro|endeavouros|garuda)
                    PKG_MANAGER="pacman"
                    ;;
                alpine)
                    PKG_MANAGER="apk"
                    ;;
                opensuse*|sles)
                    PKG_MANAGER="zypper"
                    ;;
                *)
                    # Fallback detection
                    for pm in apt dnf yum pacman apk zypper; do
                        if command -v $pm &>/dev/null; then
                            PKG_MANAGER=$pm
                            break
                        fi
                    done
                    ;;
            esac
        fi

        if [ -z "$PKG_MANAGER" ]; then
            log_error "Could not detect package manager"
            exit 1
        fi
    else
        log_error "Unsupported OS: $OSTYPE"
        exit 1
    fi

    log_success "Detected: $DISTRO ($ARCH) using $PKG_MANAGER"
}

# Check root privileges
check_root() {
    if [[ "$OS" == "linux" ]] && [[ $EUID -ne 0 ]]; then
        log_warn "Root privileges required. Re-running with sudo..."
        exec sudo -E bash "$0" "$@"
    fi
}

# Install package helper
pkg_install() {
    local packages="$@"
    case "$PKG_MANAGER" in
        apt)     apt-get install -y -qq $packages ;;
        dnf)     dnf install -y -q $packages ;;
        yum)     yum install -y -q $packages ;;
        pacman)  pacman -S --noconfirm --needed $packages ;;
        apk)     apk add --no-cache $packages ;;
        zypper)  zypper install -y $packages ;;
        brew)    brew install $packages ;;
    esac
}

# Update package manager
update_packages() {
    log_info "Updating package lists..."
    case "$PKG_MANAGER" in
        apt)     apt-get update -qq ;;
        dnf)     dnf check-update -q || true ;;
        yum)     yum check-update -q || true ;;
        pacman)  pacman -Sy --noconfirm ;;
        apk)     apk update ;;
        zypper)  zypper refresh -q ;;
        brew)    brew update ;;
    esac
}

# Install all dependencies
install_dependencies() {
    log_step "Installing Dependencies"

    update_packages

    # Basic tools
    log_info "Installing basic tools..."
    case "$PKG_MANAGER" in
        apt)     pkg_install curl wget ca-certificates gnupg lsb-release ;;
        dnf|yum) pkg_install curl wget ca-certificates ;;
        pacman)  pkg_install curl wget ca-certificates gnupg ;;
        apk)     pkg_install curl wget ca-certificates ;;
        zypper)  pkg_install curl wget ca-certificates ;;
        brew)    ;; # macOS has these
    esac
    log_success "Basic tools installed"

    # Docker
    install_docker

    # Docker Compose
    install_docker_compose

    # Node.js
    install_node

    log_success "All dependencies installed"
}

install_docker() {
    if command -v docker &>/dev/null; then
        log_success "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
    else
        log_info "Installing Docker..."

        case "$PKG_MANAGER" in
            apt)
                install -m 0755 -d /etc/apt/keyrings
                curl -fsSL "https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                chmod a+r /etc/apt/keyrings/docker.gpg
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
                apt-get update -qq
                apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
            dnf)
                dnf install -y -q dnf-plugins-core
                dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo 2>/dev/null || \
                dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                dnf install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
            yum)
                yum install -y -q yum-utils
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                yum install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
            pacman)
                pacman -S --noconfirm docker docker-compose
                ;;
            apk)
                apk add --no-cache docker docker-cli-compose openrc
                rc-update add docker boot 2>/dev/null || true
                ;;
            zypper)
                zypper install -y docker docker-compose
                ;;
            brew)
                log_error "Please install Docker Desktop: https://docker.com/products/docker-desktop"
                log_info "Then run this script again."
                exit 1
                ;;
        esac

        log_success "Docker installed"
    fi

    # Start Docker
    if [[ "$OS" == "linux" ]]; then
        systemctl start docker 2>/dev/null || service docker start 2>/dev/null || true
        systemctl enable docker 2>/dev/null || true
        [ -n "$SUDO_USER" ] && usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    fi

    # Verify Docker
    if ! docker info &>/dev/null 2>&1; then
        if [[ "$OS" == "macos" ]]; then
            log_error "Docker is not running. Please start Docker Desktop."
            exit 1
        fi
        sleep 3
        if ! docker info &>/dev/null 2>&1; then
            log_error "Docker failed to start. Run: sudo systemctl start docker"
            exit 1
        fi
    fi
    log_success "Docker is running"
}

install_docker_compose() {
    if docker compose version &>/dev/null 2>&1; then
        log_success "Docker Compose already installed"
        return
    fi

    if command -v docker-compose &>/dev/null; then
        log_success "Docker Compose (standalone) installed"
        return
    fi

    log_info "Installing Docker Compose..."

    # Try plugin first
    case "$PKG_MANAGER" in
        apt)     apt-get install -y -qq docker-compose-plugin 2>/dev/null || true ;;
        dnf|yum) $PKG_MANAGER install -y -q docker-compose-plugin 2>/dev/null || true ;;
        pacman)  pacman -S --noconfirm docker-compose 2>/dev/null || true ;;
        apk)     apk add --no-cache docker-cli-compose 2>/dev/null || true ;;
        zypper)  zypper install -y docker-compose 2>/dev/null || true ;;
    esac

    # Fallback to standalone
    if ! docker compose version &>/dev/null 2>&1 && ! command -v docker-compose &>/dev/null; then
        local compose_version=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
        curl -SL "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    log_success "Docker Compose installed"
}

install_node() {
    local required=20

    if command -v node &>/dev/null; then
        local version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $version -ge $required ]]; then
            log_success "Node.js already installed ($(node --version))"
            return
        fi
        log_warn "Node.js $(node --version) too old, need v$required+"
    fi

    log_info "Installing Node.js $required..."

    case "$PKG_MANAGER" in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_${required}.x | bash -
            apt-get install -y -qq nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_${required}.x | bash -
            $PKG_MANAGER install -y -q nodejs
            ;;
        pacman)  pacman -S --noconfirm nodejs npm ;;
        apk)     apk add --no-cache nodejs npm ;;
        zypper)  zypper install -y nodejs20 npm20 ;;
        brew)    brew install node@${required} && brew link --overwrite node@${required} ;;
    esac

    log_success "Node.js installed ($(node --version))"
}

# Download and install from Cloudflare R2
download_release() {
    log_step "Downloading Tempo Node Manager"

    local download_url
    if [[ "$RELEASE_VERSION" == "latest" ]]; then
        download_url="${DOWNLOAD_URL}/latest/tempo-node-manager.tar.gz"
    else
        download_url="${DOWNLOAD_URL}/${RELEASE_VERSION}/tempo-node-manager.tar.gz"
    fi

    log_info "Version: $RELEASE_VERSION"
    log_info "Downloading from: $download_url"

    # Create install directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # Download and extract
    if ! curl -sSL "$download_url" | tar -xz --strip-components=1; then
        log_error "Failed to download release. Check if version exists."
        exit 1
    fi

    log_success "Downloaded and extracted to $INSTALL_DIR"
}

# Setup directories and configuration
setup_application() {
    log_step "Configuring Application"

    # Create directories
    mkdir -p "$DATA_DIR" "$CONFIG_DIR"
    chmod 755 "$DATA_DIR"
    chmod 700 "$CONFIG_DIR"

    # Generate JWT secret
    local jwt_secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)

    # Create .env file
    cat > "$CONFIG_DIR/.env" << EOF
# Tempo Node Manager Configuration
# Generated: $(date -Iseconds)

PORT=$AGENT_PORT
JWT_SECRET=$jwt_secret
DATABASE_URL=file:$CONFIG_DIR/data.db
TEMPO_DATA_DIR=$DATA_DIR
TEMPO_VERSION=$TEMPO_VERSION
TEMPO_HTTP_PORT=$HTTP_PORT
TEMPO_P2P_PORT=$P2P_PORT
NODE_ENV=production
EOF

    chmod 600 "$CONFIG_DIR/.env"

    # Link .env to install dir
    ln -sf "$CONFIG_DIR/.env" "$INSTALL_DIR/.env"

    # Initialize database schema
    log_info "Initializing database..."
    cd "$INSTALL_DIR"
    DATABASE_URL="file:$CONFIG_DIR/data.db" npx prisma db push --skip-generate 2>/dev/null || true
    cd - > /dev/null

    log_success "Configuration created"
}

# Pull Tempo Docker image
pull_tempo_image() {
    log_step "Pulling Tempo Docker Image"

    docker pull --platform linux/amd64 "ghcr.io/tempoxyz/tempo:${TEMPO_VERSION}"

    log_success "Tempo image pulled"
}

# Create and start systemd service
create_and_start_service() {
    log_step "Creating and Starting Service"

    if [[ "$OS" == "linux" ]] && command -v systemctl &>/dev/null; then
        cat > /etc/systemd/system/tempo-node-manager.service << EOF
[Unit]
Description=Tempo Node Manager
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$CONFIG_DIR/.env
ExecStart=/usr/bin/node $INSTALL_DIR/dist/agent/src/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload
        systemctl enable tempo-node-manager
        systemctl start tempo-node-manager

        log_success "Service created and started"

    elif [[ "$OS" == "macos" ]]; then
        local plist="$HOME/Library/LaunchAgents/com.tempo.node-manager.plist"
        mkdir -p "$(dirname "$plist")"

        cat > "$plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tempo.node-manager</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$INSTALL_DIR/dist/agent/src/main.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

        launchctl load "$plist"
        log_success "LaunchAgent created and started"
    fi
}

# Wait for service to be ready
wait_for_service() {
    log_info "Waiting for service to start..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:${AGENT_PORT}/api/health" &>/dev/null; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done

    log_warn "Service may still be starting..."
    return 1
}

# Print success message
print_success() {
    local ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "localhost")

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║   ${BOLD}Tempo Node Manager Installed Successfully!${NC}${GREEN}              ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC}  ${BOLD}Dashboard URL:${NC}                                            ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                                             ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}    ${BOLD}${GREEN}http://${ip_addr}:${AGENT_PORT}${NC}                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                                             ${CYAN}│${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "${BOLD}Quick Commands:${NC}"
    echo ""
    if [[ "$OS" == "linux" ]]; then
        echo "  Check status:   sudo systemctl status tempo-node-manager"
        echo "  View logs:      sudo journalctl -u tempo-node-manager -f"
        echo "  Restart:        sudo systemctl restart tempo-node-manager"
        echo "  Stop:           sudo systemctl stop tempo-node-manager"
    else
        echo "  Check status:   launchctl list | grep tempo"
        echo "  View logs:      tail -f $INSTALL_DIR/logs/*.log"
        echo "  Stop:           launchctl unload ~/Library/LaunchAgents/com.tempo.node-manager.plist"
    fi
    echo ""
    echo -e "${BOLD}Endpoints:${NC}"
    echo ""
    echo "  RPC:            http://${ip_addr}:${HTTP_PORT}"
    echo "  P2P:            ${ip_addr}:${P2P_PORT}"
    echo "  Metrics:        http://${ip_addr}:${AGENT_PORT}/api/metrics/prometheus"
    echo ""
    echo -e "${YELLOW}Note:${NC} Set your admin password on first login."
    echo -e "${YELLOW}Note:${NC} Open ports ${AGENT_PORT}, ${HTTP_PORT}, ${P2P_PORT} in your firewall."
    echo ""
}

# Main
main() {
    print_banner

    detect_system
    check_root "$@"

    install_dependencies
    download_release
    setup_application
    pull_tempo_image
    create_and_start_service

    if wait_for_service; then
        log_success "Service is running!"
    fi

    print_success
}

main "$@"
