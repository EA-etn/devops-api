# devops-api

API mínima en **FastAPI** para practicar **Docker** y **CI/CD con GitHub Actions**.

## Endpoints

| Ruta      | Descripción                                  |
|-----------|----------------------------------------------|
| `/`       | Mensaje de bienvenida y versión              |
| `/health` | Health check (Docker, Kubernetes, balanceadores) |
| `/info`   | Hostname del contenedor, versión y hora UTC  |
| `/docs`   | Documentación interactiva (Swagger)          |

## Desarrollo local

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Lint y tests:

```bash
ruff check . && ruff format --check .
pytest -v
```

## Docker

```bash
docker build -t devops-api --build-arg APP_VERSION=0.1.0 .
docker run -p 8000:8000 devops-api
curl localhost:8000/health
```

Buenas prácticas aplicadas en el `Dockerfile`:

- **Multi-stage build**: las herramientas de compilación no llegan a la imagen final.
- **Usuario sin privilegios** (`appuser`, UID 10001).
- **HEALTHCHECK** nativo contra `/health`.
- `.dockerignore` para un contexto de build pequeño.

## CI/CD (`.github/workflows/ci.yml`)

```
push / PR ──► lint-test (ruff + pytest) ──► build-push (Docker)
```

- **Pull requests**: lint, tests, build de la imagen y *smoke test* (sin push).
- **Push a `main`**: además publica la imagen en GHCR → `ghcr.io/<usuario>/<repo>:main` y `:sha-xxxxxxx`.
- **Tag `v1.2.3`**: publica `ghcr.io/<usuario>/<repo>:1.2.3`.
- Caché de capas Docker con GitHub Actions cache.
- **Imagen multi-arquitectura**: `linux/amd64` y `linux/arm64` bajo la misma etiqueta.
  Docker descarga automáticamente la variante de cada máquina.
- En los PR, la imagen se arranca en **ambas arquitecturas** (arm64 emulada con QEMU).

## Raspberry Pi

Funciona en Raspberry Pi 3/4/5 con **sistema operativo de 64 bits** (arm64):

```bash
docker run -p 8000:8000 ghcr.io/ea-etn/devops-api:main
curl localhost:8000/info
```

Comprueba tu arquitectura con `uname -m` → debe decir `aarch64`.
Raspberry Pi OS de 32 bits (`armv7l`) no está soportado.

Para lanzar una release:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Próximos pasos

- [ ] Escaneo de vulnerabilidades de la imagen con Trivy
- [ ] Despliegue automático (Cloud Run / Kubernetes)
- [ ] Infra como código con Terraform
