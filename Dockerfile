# ---------- Etapa 1: construir dependencias ----------
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- Etapa 2: imagen final mínima ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Parches de seguridad del sistema base: la imagen oficial tarda en publicarse
# tras una CVE nueva, y la puerta de calidad de Trivy bloquea si hay arreglo disponible.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

# Usuario sin privilegios (buena práctica de seguridad)
RUN groupadd --gid 10001 appuser \
 && useradd --create-home --uid 10001 --gid 10001 appuser

COPY --from=builder /install /usr/local
WORKDIR /app
COPY app/ ./app/

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

# UID numérico: Kubernetes puede verificar runAsNonRoot sin resolver nombres
USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

# app.serve arranca uvicorn y sale con código 0 tras un apagado limpio (ver app/serve.py)
CMD ["python", "-m", "app.serve"]
