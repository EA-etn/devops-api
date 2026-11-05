"""API mínima para practicar Docker, CI/CD, Kubernetes y GitOps."""

import os
import platform
import socket
from datetime import UTC, datetime

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

APP_VERSION = os.getenv("APP_VERSION", "dev")

app = FastAPI(title="demo-api", version=APP_VERSION)

# Expone /metrics en formato Prometheus: peticiones, latencias y códigos de estado
Instrumentator(excluded_handlers=["/health", "/metrics"]).instrument(app).expose(
    app, include_in_schema=False
)


@app.get("/")
def root() -> dict:
    return {"message": "Hola desde demo-api", "version": APP_VERSION}


@app.get("/health")
def health() -> dict:
    """Endpoint de salud para Docker HEALTHCHECK, Kubernetes probes, etc."""
    return {"status": "ok"}


@app.get("/info")
def info() -> dict:
    """Qué réplica responde: pod (hostname), nodo de Kubernetes y arquitectura de CPU."""
    return {
        "hostname": socket.gethostname(),
        "node": os.getenv("NODE_NAME", "unknown"),
        "arch": platform.machine(),
        "version": APP_VERSION,
        "time": datetime.now(UTC).isoformat(),
    }
