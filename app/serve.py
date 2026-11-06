"""Arranque de la API con apagado limpio.

Uvicorn cierra ordenadamente al recibir SIGTERM, pero después vuelve a lanzar la señal
con signal.raise_signal() para que el proceso "muera por la señal" (código 143).
En Kubernetes eso marca el pod como "Error", y en algunos nodos (perfil AppArmor de
containerd) raise_signal() incluso falla con PermissionError (código 1).

Para Kubernetes, SIGTERM es el apagado normal: tras cerrar ordenadamente salimos con 0
y no relanzamos la señal.
"""

import contextlib
import os
import signal
import threading
from collections.abc import Generator

import uvicorn


class Server(uvicorn.Server):
    @contextlib.contextmanager
    def capture_signals(self) -> Generator[None, None, None]:
        # Igual que uvicorn, pero sin relanzar la señal al terminar
        if threading.current_thread() is not threading.main_thread():
            yield
            return
        handled = (signal.SIGINT, signal.SIGTERM)
        original = {sig: signal.signal(sig, self.handle_exit) for sig in handled}
        try:
            yield
        finally:
            for sig, handler in original.items():
                signal.signal(sig, handler)


def main() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        # Tiempo máximo para terminar las peticiones en curso (< terminationGracePeriodSeconds)
        timeout_graceful_shutdown=int(os.getenv("GRACEFUL_SHUTDOWN_TIMEOUT", "20")),
    )
    Server(config).run()


if __name__ == "__main__":
    main()
