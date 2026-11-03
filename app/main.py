"""API mínima para practicar Docker + CI/CD."""

import os
import socket
from datetime import UTC, datetime

from fastapi import FastAPI

APP_VERSION = os.getenv("APP_VERSION", "dev")

app = FastAPI(title="devops-api", version=APP_VERSION)


@app.get("/")
def root() -> dict:
    return {"message": "Hola desde devops-api", "version": APP_VERSION}


@app.get("/health")
def health() -> dict:
    """Endpoint de salud para Docker HEALTHCHECK, Kubernetes probes, etc."""
    return {"status": "ok"}


@app.get("/info")
def info() -> dict:
    return {
        "hostname": socket.gethostname(),
        "version": APP_VERSION,
        "time": datetime.now(UTC).isoformat(),
    }
