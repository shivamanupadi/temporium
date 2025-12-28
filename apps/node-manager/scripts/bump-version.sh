#!/bin/bash
set -e

# Usage: ./scripts/bump-version.sh <patch|minor|major|version>
# Examples:
#   ./scripts/bump-version.sh patch   # 0.1.0 -> 0.1.1
#   ./scripts/bump-version.sh minor   # 0.1.0 -> 0.2.0
#   ./scripts/bump-version.sh major   # 0.1.0 -> 1.0.0
#   ./scripts/bump-version.sh 0.2.0   # explicit version

if [ -z "$1" ]; then
  echo "Usage: $0 <patch|minor|major|version>"
  echo "Examples:"
  echo "  $0 patch   # 0.1.0 -> 0.1.1"
  echo "  $0 minor   # 0.1.0 -> 0.2.0"
  echo "  $0 major   # 0.1.0 -> 1.0.0"
  echo "  $0 0.2.0   # explicit version"
  exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Get current version from root package.json
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')

echo "Current version: $CURRENT_VERSION"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$1" in
  patch)
    PATCH=$((PATCH + 1))
    VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  *)
    VERSION="$1"
    # Validate version format (semver)
    if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Error: Version must be in semver format (e.g., 0.2.0)"
      exit 1
    fi
    ;;
esac

echo "Bumping version to $VERSION..."

# Cross-platform sed in-place edit function
sed_inplace() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# Update root package.json
sed_inplace "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
echo "  Updated package.json"

# Update api/package.json
sed_inplace "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" api/package.json
echo "  Updated api/package.json"

# Update web/package.json
sed_inplace "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" web/package.json
echo "  Updated web/package.json"

echo ""
echo "Version bumped to $VERSION"

# Commit changes
git add -A
git commit -m "chore: bump version to $VERSION"
echo "  Committed changes"

# Push to remote
git push
echo "  Pushed to remote"

echo ""
echo "Version $VERSION ready. Run 'yarn release' to create tag and trigger CI."
