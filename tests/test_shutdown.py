"""El proceso debe terminar con código 0 al recibir SIGTERM (como hace Kubernetes)."""

import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request

import pytest

# Simula un nodo donde enviarse una señal a uno mismo está prohibido (AppArmor):
# si algo llama a signal.raise_signal(), el proceso termina con error.
_RAISE_FORBIDDEN = (
    "import signal\n"
    "def _forbidden(sig):\n"
    "    raise PermissionError(13, 'Permission denied')\n"
    "signal.raise_signal = _forbidden\n"
    "from app.serve import main\n"
    "main()\n"
)


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.mark.parametrize(
    "cmd",
    [["-m", "app.serve"], ["-c", _RAISE_FORBIDDEN]],
    ids=["normal", "raise_signal-prohibido"],
)
def test_sigterm_exits_with_code_0(cmd):
    port = _free_port()
    env = {**os.environ, "HOST": "127.0.0.1", "PORT": str(port)}
    proc = subprocess.Popen(
        [sys.executable, *cmd],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
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
        code = proc.wait(timeout=30)
        assert code == 0, proc.stderr.read().decode()
    finally:
        if proc.poll() is None:
            proc.kill()
