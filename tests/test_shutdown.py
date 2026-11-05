"""El proceso debe terminar con código 0 al recibir SIGTERM (como hace Kubernetes)."""

import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_sigterm_exits_with_code_0():
    port = _free_port()
    env = {**os.environ, "HOST": "127.0.0.1", "PORT": str(port)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "app.serve"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError("la API no arrancó")
        proc.send_signal(signal.SIGTERM)
        assert proc.wait(timeout=30) == 0
    finally:
        if proc.poll() is None:
            proc.kill()
