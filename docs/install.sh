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

# ─── ANSI helpers ─────────────────────────────────────────────
# All output goes to stderr so users can `| tee` the script and still
# capture clean stdout. ANSI-C quoting ($'...') is required so the
# backslash escapes are interpreted by bash — single-quoted strings
# preserve them as literal text.

_C=$'\033[0m'     # reset
_B=$'\033[1m'     # bold
_D=$'\033[2m'     # dim
_CY=$'\033[36m'   # cyan
_GR=$'\033[32m'   # green
_YE=$'\033[33m'   # yellow
_RD=$'\033[31m'   # red
_CR=$'\r'         # carriage return
_CL=$'\033[2K'    # clear entire line
_HC=$'\033[?25l'  # hide cursor
_SC=$'\033[?25h'  # show cursor

is_tty() {
  [ -t 2 ] && [ -z "${NO_COLOR:-}" ]
}

# ─── Spinner ──────────────────────────────────────────────────
# A rotating glyph + label, redrawn on the same line via \r + clear-line.
# Runs in a background subshell; EXIT trap restores the cursor. The
# spinner is intentionally simple (4 frames, 120ms) so the terminal
# doesn't get flooded with escape codes.
_SPINNER_PID=""

spinner_start() {
  local text="$1"
  if is_tty; then
    printf '%s' "$_HC" >&2
    (
      i=0
      while :; do
        case $((i % 4)) in
          0) g='⠋' ;; 1) g='⠙' ;; 2) g='⠸' ;; 3) g='⠴' ;;
        esac
        printf '%s%s%s %s%s %s' "$_CL" "$_CR" "$_B" "$_CY" "$g" "$_C" >&2
        printf '%s' "$text" >&2
        i=$((i + 1))
        sleep 0.12
      done
    ) &
    _SPINNER_PID=$!
  else
    printf '%s %s%s%s %s\n' "$_D" "$_B" "$_CY" "•" "$_C$text" >&2
  fi
}

_spinner_stop() {
  local ok="${1:-1}"
  if is_tty && [ -n "$_SPINNER_PID" ]; then
    kill "$_SPINNER_PID" 2>/dev/null || true
    wait "$_SPINNER_PID" 2>/dev/null || true
    _SPINNER_PID=""
    if [ "$ok" = "1" ]; then
      printf '%s%s %s✓%s done\n' "$_CL" "$_CR" "$_B" "$_GR" >&2
    else
      printf '%s%s %s✗%s failed\n' "$_CL" "$_CR" "$_B" "$_RD" >&2
    fi
  fi
}

spinner_ok()   { _spinner_stop 1; }
spinner_fail() { _spinner_stop 0; }

cleanup_spinner() {
  if [ -n "$_SPINNER_PID" ]; then
    kill "$_SPINNER_PID" 2>/dev/null || true
    wait "$_SPINNER_PID" 2>/dev/null || true
  fi
  printf '%s' "$_SC" >&2
}
trap cleanup_spinner EXIT

# ─── progress_bar_download ────────────────────────────────────
# Wrapper around `curl` that uses curl's built-in progress bar (-#) on a
# TTY. On non-TTY (CI, piped) we just silence curl's own status output.
# The spinner must NOT be running when this is called — curl draws the
# bar directly and we print a single "done" line afterwards.
progress_bar_download() {
  local url="$1" out="$2"
  if is_tty; then
    curl -fL --connect-timeout 15 -# -o "$out" "$url" >&2
  else
    curl -fsSL --connect-timeout 15 -o "$out" "$url"
  fi
}

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
  npm install -g @qvac/sdk
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
  spinner_start "fetching latest omni release"
  LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
           | grep '"tag_name"' | head -1 | sed -E 's/.*"v?([^"]+)".*/\1/')
  if [ -z "$LATEST" ]; then
    spinner_fail
    echo "Could not determine latest version of ${REPO}." >&2
    echo "Check your network connection or specify OMNI_VERSION=v0.1.0" >&2
    exit 1
  fi
  spinner_ok
fi

# ─── Build URLs ──────────────────────────────────────────────
EXT="tar.gz"
[ "$OS" = "windows" ] && EXT="zip"
BASE_URL="https://github.com/${REPO}/releases/download/v${LATEST}"
ARCHIVE_URL="${BASE_URL}/${BINARY}-${OS}-${ARCH}.${EXT}"
SUMS_URL="${BASE_URL}/checksums.txt"

# ─── Prepare temp dir ────────────────────────────────────────
TMP=$(mktemp -d)
TMP_CLEANUP="rm -rf $TMP"
trap 'cleanup_spinner; eval "$TMP_CLEANUP"' EXIT

echo "  ${_B}→${_C} installing omni v${LATEST} (${OS}-${ARCH})" >&2

# ─── Download with progress bar ──────────────────────────────
# We don't run the spinner for the download — curl's own bar (-#) is the
# progress indicator. Just announce the phase, then let curl run, then
# print a single "done" line.
if is_tty; then
  printf '%s%s%s %s\n' "$_B" "$_CY" "⠋" "$_C  downloading omni v${LATEST}" >&2
else
  printf '  downloading omni v%s\n' "${LATEST}" >&2
fi
if ! progress_bar_download "$ARCHIVE_URL" "$TMP/omni.${EXT}"; then
  printf '%s✗%s download failed\n' "$_B$_RD" "$_C" >&2
  echo "  url: $ARCHIVE_URL" >&2
  echo "  Check that v${LATEST} has binaries published for ${OS}-${ARCH}." >&2
  exit 1
fi
if is_tty; then
  printf '%s%s%s%s done\n' "$_B" "$_GR" "✓" "$_C" >&2
fi

# ─── Verify SHA-256 ─────────────────────────────────────────
spinner_start "verifying SHA-256"
if ! curl -fsSL "$SUMS_URL" -o "$TMP/checksums.txt" 2>/dev/null; then
  spinner_ok
  echo "  ${_YE}!${_C} checksums.txt not found for v${LATEST}; skipping verification" >&2
else
  EXPECTED=$(grep -E "(^| )${BINARY}-${OS}-${ARCH}\.${EXT}$" "$TMP/checksums.txt" | head -1 | awk '{print $1}')
  if [ -z "$EXPECTED" ]; then
    spinner_ok
    echo "  ${_YE}!${_C} no checksum entry for ${BINARY}-${OS}-${ARCH}.${EXT}; skipping" >&2
  else
    ACTUAL=""
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL=$(sha256sum "$TMP/omni.${EXT}" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      ACTUAL=$(shasum -a 256 "$TMP/omni.${EXT}" | awk '{print $1}')
    else
      spinner_fail
      echo "No sha256sum or shasum found; cannot verify." >&2
      exit 1
    fi
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      spinner_fail
      echo "SHA-256 mismatch!" >&2
      echo "  expected: $EXPECTED" >&2
      echo "  actual:   $ACTUAL" >&2
      exit 1
    fi
    spinner_ok
  fi
fi

# ─── Extract ─────────────────────────────────────────────────
spinner_start "extracting"
case "$EXT" in
  tar.gz) tar -xzf "$TMP/omni.${EXT}" -C "$TMP" ;;
  zip)    unzip -q "$TMP/omni.${EXT}" -d "$TMP" ;;
esac
spinner_ok

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
  sudo cp -r "$TMP/${BINARY}-${OS}-${ARCH}/"* "$INSTALL_DIR/"
  sudo chmod +x "$INSTALL_DIR/${EXE}"
else
  mkdir -p "$INSTALL_DIR"
  cp -r "$TMP/${BINARY}-${OS}-${ARCH}/"* "$INSTALL_DIR/"
  chmod +x "$INSTALL_DIR/${EXE}"
fi

echo ""
printf '%s✓%s omni v%s installed to %s\n\n' "$_B$_GR" "$_C" "${LATEST}" "$INSTALL_DIR/${EXE}"
echo "Next steps:"
echo "  1. Make sure $INSTALL_DIR is on your PATH"
echo "  2. Run: omni doctor"
echo "  3. Run: omni host    (boots the mesh coordinator + dashboard)"
echo "     ↳ prints a dashboard URL like http://127.0.0.1:3005/?token=..."
echo "     ↳ the secret is stored at ~/.omni/secret (mode 0600)"
echo "  4. On other machines: omni join <pubkey> --secret=<token>"
echo ""
echo "Optional: install the QVAC SDK for full P2P inference."
echo "  npm install -g @qvac/sdk"
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
