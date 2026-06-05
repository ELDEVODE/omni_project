#!/usr/bin/env bash
# OmniMesh installer
# Detects OS/arch, fetches the latest release from GitHub, verifies SHA-256,
# and installs to ~/.local/bin (or /usr/local/bin with sudo).
#
# Usage:
#   curl -fsSL https://eldevode.github.io/omni_project/install.sh | bash
#   OMNI_VERSION=v0.1.0 curl -fsSL .../install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --system   # install to /usr/local/bin

set -euo pipefail

REPO="ELDEVODE/omni_project"
BINARY="omni"

# ─── Parse args ───────────────────────────────────────────────
SYSTEM_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --system)        SYSTEM_INSTALL=1 ;;
    -h|--help)
      cat <<EOF
OmniMesh installer

Usage: install.sh [options]

Options:
  --system           Install to /usr/local/bin (uses sudo if needed)
  --prefix <dir>     Install to <dir> instead of ~/.local/bin
  OMNI_VERSION=vX    Install a specific version (default: latest)

The QVAC SDK is an optional peer dependency. Install it separately with:
  bun add @qvac/sdk
EOF
      exit 0
      ;;
  esac
done

# ─── Detect OS ───────────────────────────────────────────────
case "$(uname -s)" in
  Darwin)         OS="darwin" ;;
  Linux)          OS="linux"  ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
  *) echo "Unsupported OS: $(uname -s)"; exit 1 ;;
esac

# ─── Detect arch ─────────────────────────────────────────────
case "$(uname -m)" in
  x86_64|amd64)   ARCH="x64"   ;;
  arm64|aarch64)  ARCH="arm64" ;;
  *) echo "Unsupported arch: $(uname -m)"; exit 1 ;;
esac

# ─── Pick install dir ────────────────────────────────────────
if [ "$SYSTEM_INSTALL" -eq 1 ]; then
  INSTALL_DIR="/usr/local/bin"
elif [ -n "${OMNI_INSTALL_DIR:-}" ]; then
  INSTALL_DIR="$OMNI_INSTALL_DIR"
else
  INSTALL_DIR="$HOME/.local/bin"
fi

# ─── Pick the latest release tag from GitHub API ─────────────
if [ -n "${OMNI_VERSION:-}" ]; then
  LATEST="${OMNI_VERSION#v}"
else
  echo "→ Fetching latest omni release..."
  LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
           | grep '"tag_name"' | head -1 | sed -E 's/.*"v?([^"]+)".*/\1/')
  if [ -z "$LATEST" ]; then
    echo "Could not determine latest version of ${REPO}." >&2
    echo "Check your network connection or specify OMNI_VERSION=v0.1.0" >&2
    exit 1
  fi
fi

# ─── Build URLs ──────────────────────────────────────────────
EXT="tar.gz"
[ "$OS" = "windows" ] && EXT="zip"
BASE_URL="https://github.com/${REPO}/releases/download/v${LATEST}"
ARCHIVE_URL="${BASE_URL}/${BINARY}-${OS}-${ARCH}.${EXT}"
SUMS_URL="${BASE_URL}/checksums.txt"

# ─── Prepare temp dir ────────────────────────────────────────
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "→ Downloading omni v${LATEST} (${OS}-${ARCH})..."
if ! curl -fsSL "$ARCHIVE_URL" -o "$TMP/omni.${EXT}"; then
  echo "Download failed: $ARCHIVE_URL" >&2
  echo "Check that v${LATEST} has binaries published for ${OS}-${ARCH}." >&2
  exit 1
fi

# ─── Verify SHA-256 ─────────────────────────────────────────
echo "→ Verifying SHA-256..."
if ! curl -fsSL "$SUMS_URL" -o "$TMP/checksums.txt"; then
  echo "WARNING: checksums.txt not found for v${LATEST}; skipping verification." >&2
else
  EXPECTED=$(grep -E "(^| )${BINARY}-${OS}-${ARCH}\.${EXT}$" "$TMP/checksums.txt" | head -1 | awk '{print $1}')
  if [ -z "$EXPECTED" ]; then
    echo "WARNING: no checksum entry for ${BINARY}-${OS}-${ARCH}.${EXT}; skipping." >&2
  else
    ACTUAL=""
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL=$(sha256sum "$TMP/omni.${EXT}" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      ACTUAL=$(shasum -a 256 "$TMP/omni.${EXT}" | awk '{print $1}')
    else
      echo "No sha256sum or shasum found; cannot verify." >&2
      exit 1
    fi
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      echo "SHA-256 mismatch!" >&2
      echo "  expected: $EXPECTED" >&2
      echo "  actual:   $ACTUAL" >&2
      exit 1
    fi
    echo "  ✓ checksum ok"
  fi
fi

# ─── Extract ─────────────────────────────────────────────────
case "$EXT" in
  tar.gz) tar -xzf "$TMP/omni.${EXT}" -C "$TMP" ;;
  zip)    unzip -q "$TMP/omni.${EXT}" -d "$TMP" ;;
esac

EXE="omni"
[ "$OS" = "windows" ] && EXE="omni.exe"
BIN_PATH="$TMP/${BINARY}-${OS}-${ARCH}/${EXE}"

if [ ! -f "$BIN_PATH" ]; then
  echo "Extracted archive is missing the expected binary at $BIN_PATH" >&2
  exit 1
fi

# ─── Install ─────────────────────────────────────────────────
NEED_SUDO=0
if [ ! -w "$(dirname "$INSTALL_DIR")" ] || { [ -e "$INSTALL_DIR" ] && [ ! -w "$INSTALL_DIR" ]; }; then
  NEED_SUDO=1
fi

if [ "$NEED_SUDO" -eq 1 ]; then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "Cannot write to $INSTALL_DIR and sudo is not available." >&2
    echo "Re-run with --prefix to pick a writable directory." >&2
    exit 1
  fi
  echo "→ Installing to $INSTALL_DIR (sudo)"
  sudo mkdir -p "$INSTALL_DIR"
  sudo cp "$BIN_PATH" "$INSTALL_DIR/${EXE}"
  sudo chmod +x "$INSTALL_DIR/${EXE}"
else
  mkdir -p "$INSTALL_DIR"
  cp "$BIN_PATH" "$INSTALL_DIR/${EXE}"
  chmod +x "$INSTALL_DIR/${EXE}"
fi

echo ""
echo "✓ omni v${LATEST} installed to $INSTALL_DIR/${EXE}"
echo ""
echo "Next steps:"
echo "  1. Make sure $INSTALL_DIR is on your PATH"
echo "  2. Run: omni doctor"
echo "  3. Run: omni host    (boots the mesh coordinator + dashboard)"
echo "     ↳ prints a dashboard URL like http://127.0.0.1:3005/?token=..."
echo "     ↳ the secret is stored at ~/.omni/secret (mode 0600)"
echo "  4. On other machines: omni join <pubkey> --secret=<token>"
echo ""
echo "Optional: install the QVAC SDK for full P2P inference."
echo "  bun add @qvac/sdk"
echo ""

# ─── PATH hint ───────────────────────────────────────────────
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    SHELL_NAME=$(basename "${SHELL:-/bin/bash}")
    case "$SHELL_NAME" in
      zsh)  RC="$HOME/.zshrc"  ;;
      bash) RC="$HOME/.bashrc" ;;
      fish) RC="$HOME/.config/fish/config.fish" ;;
      *)    RC="" ;;
    esac
    if [ -n "$RC" ]; then
      echo "  ⚠ Add this to $RC and restart your shell:"
      echo "      export PATH=\"$INSTALL_DIR:\$PATH\""
    fi
    ;;
esac
