"""Arranque de la API con apagado limpio.

Uvicorn ≥ 0.29 cierra ordenadamente al recibir SIGTERM, pero después vuelve a lanzar
la señal: el proceso termina con código 143 y Kubernetes muestra el pod como "Error".
Aquí registramos antes un manejador propio de SIGTERM. Uvicorn lo restaura al terminar
y, al relanzar la señal, salimos con código 0.
"""

import os
import signal
import sys

import uvicorn


def _exit_cleanly(signum, frame):  # noqa: ARG001
    sys.exit(0)


def main() -> None:
    signal.signal(signal.SIGTERM, _exit_cleanly)
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        # Tiempo máximo para terminar las peticiones en curso (< terminationGracePeriodSeconds)
        timeout_graceful_shutdown=int(os.getenv("GRACEFUL_SHUTDOWN_TIMEOUT", "20")),
    )


if __name__ == "__main__":
    main()
