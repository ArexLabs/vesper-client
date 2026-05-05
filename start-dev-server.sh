#!/bin/bash
cd "$(dirname "$0")" || exit 1
npm run dev:server &
sleep 5
# Exit successfully so Tauri continues
exit 0
