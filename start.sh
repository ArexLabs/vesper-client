#!/bin/bash
set -e

echo "Starting Vesper Launcher..."
echo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "target/release/vesper-ui" ]; then
    echo "Building release build..."
    cargo build --release
fi

./target/release/vesper-supervisor &
SUPERVISOR_PID=$!

sleep 2

./target/release/vesper-ui &
UI_PID=$!

echo "Launcher started!"
echo "  Supervisor PID: $SUPERVISOR_PID"
echo "  UI PID: $UI_PID"
echo
echo "Press Ctrl+C to stop"

trap "kill $SUPERVISOR_PID $UI_PID 2>/dev/null" EXIT

wait