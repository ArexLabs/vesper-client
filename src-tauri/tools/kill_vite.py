#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""
Watchdog that kills the Vite dev server when the Play backend on port 9000 dies.

Usage:
    uv run src-tauri/tools/kill_vite.py
"""

import os
import signal
import socket
import subprocess
import sys
import time

VITE_PORT = 5173
PLAY_PORT = 9000
POLL_INTERVAL = 2.5


def port_is_open(port: int, host: str = "localhost") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            s.connect((host, port))
            return True
        except (ConnectionRefusedError, OSError):
            return False


def resolve_vite_cmd() -> tuple[list[str], str]:
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    if sys.platform == "win32":
        candidates = [
            os.path.join(root, "node_modules", ".bin", "vite.cmd"),
            os.path.join(root, "node_modules", "vite", "bin", "vite.js"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return (["node", c] if c.endswith(".js") else [c], root)
    else:
        candidates = [
            os.path.join(root, "node_modules", ".bin", "vite"),
            os.path.join(root, "node_modules", "vite", "bin", "vite.js"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return ([c], root) if os.access(c, os.X_OK) else (["node", c], root)

    print("Error: Vite binary not found. Run npm install first.", file=sys.stderr)
    sys.exit(1)


def kill_process(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
        )
    else:
        pgid = os.getpgid(proc.pid)
        os.killpg(pgid, signal.SIGTERM)
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(pgid, signal.SIGKILL)


def main() -> None:
    cmd, cwd = resolve_vite_cmd()

    print("Spawning Vite Dev server...")

    kwargs: dict = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(cmd, cwd=cwd, **kwargs)
    time.sleep(2)

    try:
        while True:
            time.sleep(POLL_INTERVAL)
            if not port_is_open(PLAY_PORT):
                break
    except KeyboardInterrupt:
        pass
    finally:
        print("Closing Vite Dev server")
        kill_process(proc)


if __name__ == "__main__":
    main()
