# devops-api

[![CI/CD](https://github.com/EA-etn/devops-api/actions/workflows/ci.yml/badge.svg)](https://github.com/EA-etn/devops-api/actions/workflows/ci.yml)

API mínima en **FastAPI** usada como hilo conductor para practicar el ciclo DevOps completo:
**código → tests → seguridad → contenedor multi-arquitectura firmado → Kubernetes → GitOps**.

> La aplicación es deliberadamente simple. Lo importante es **cómo se construye, se asegura, se prueba y se despliega**.

## Arquitectura

```
 Developer ──► Pull Request ──────────────────────────────────────────────────────┐
                    │                                                             │
                    ▼                       GitHub Actions (CI)                   │
   ┌─────────────────────────────────────────────────────────────────────┐        │
   │ lint-test   ruff + pytest                                           │        │
   │ security    Trivy: dependencias, secretos, Dockerfile, Helm ─► Security tab  │
   │ helm        helm lint + kubeconform                                 │        │
   │ e2e-k3s     imagen ─► Trivy ─► clúster k3s de 3 nodos ─► helm test  │        │
   │ build       multi-arch amd64/arm64 + smoke test arm64 (QEMU)        │        │
   └─────────────────────────────────────────────────────────────────────┘        │
                    │ merge a main                                                │
                    ▼                       GitHub Actions (CD)                   │
   ┌─────────────────────────────────────────────────────────────────────┐        │
   │ build       push a GHCR + SBOM + provenance + Trivy + firma Cosign  │        │
   │ gitops      commit: values-homelab.yaml  image.tag = sha-xxxxxxx    │────────┘
   └─────────────────────────────────────────────────────────────────────┘   (Git = fuente de verdad)
                                                                    │
                          ArgoCD (en el clúster) vigila Git ◄───────┘
                                    │  sync automático + selfHeal
                                    ▼
                 Homelab k3s:  Raspberry Pi (arm64)  +  PC (amd64)
```

## Endpoints

| Ruta       | Descripción                                                  |
|------------|--------------------------------------------------------------|
| `/`        | Mensaje de bienvenida y versión                              |
| `/health`  | Health check (Docker HEALTHCHECK y probes de Kubernetes)     |
| `/info`    | Hostname (= nombre del pod), versión y hora UTC              |
| `/metrics` | Métricas en formato Prometheus (peticiones, latencias, códigos) |
| `/docs`    | Documentación interactiva (Swagger)                          |

## Inicio rápido

```bash
make install      # entorno virtual + dependencias
make test         # tests
make run          # API en http://localhost:8000 con recarga automática
make help         # todos los comandos
```

Con Docker (la imagen publicada funciona en PC x86 y en Raspberry Pi 64 bits):

```bash
docker run -p 8000:8000 ghcr.io/ea-etn/devops-api:main
curl localhost:8000/info
```

## Qué incluye

### 🐳 Contenedor

- **Multi-stage build**: las herramientas de instalación no llegan a la imagen final.
- **Usuario sin privilegios** con UID numérico (`10001`), compatible con `runAsNonRoot`.
- **HEALTHCHECK** nativo contra `/health`.
- **Multi-arquitectura**: `linux/amd64` + `linux/arm64` bajo la misma etiqueta.

### 🔐 Seguridad (DevSecOps)

| Control | Herramienta | Cuándo |
|---|---|---|
| Vulnerabilidades en dependencias | Trivy (`fs`) | Cada PR y push |
| Secretos filtrados en el código | Trivy (`secret`) | Cada PR y push |
| Malas configuraciones (Dockerfile, Helm) | Trivy (`misconfig`) | Cada PR y push |
| Vulnerabilidades de la imagen | Trivy (`image`) | PR (imagen local) y main (imagen publicada) |
| Inventario de componentes (SBOM) | BuildKit (SPDX) | Cada imagen publicada |
| Procedencia del build (SLSA provenance) | BuildKit | Cada imagen publicada |
| Firma de la imagen | Cosign keyless (Sigstore) | Cada imagen publicada |
| Actualizaciones de dependencias | Dependabot (pip, actions, docker) | Semanal |
| Actions fijadas por SHA de commit | — | Siempre |

Los resultados de Trivy aparecen en la pestaña **Security → Code scanning** del repositorio.
El pipeline **falla** ante cualquier hallazgo HIGH/CRITICAL que tenga solución disponible.

**Verificar la firma de una imagen** (demuestra que la construyó este pipeline y no fue alterada):

```bash
cosign verify ghcr.io/ea-etn/devops-api:main \
  --certificate-identity-regexp '^https://github.com/EA-etn/devops-api/\.github/workflows/ci\.yml@refs/(heads/main|tags/v.*)$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

**Ver el SBOM** de la imagen publicada:

```bash
docker buildx imagetools inspect ghcr.io/ea-etn/devops-api:main --format '{{ json .SBOM }}'
```

### ☸️ Kubernetes (Helm chart en `chart/devops-api`)

- Probes de **startup, liveness y readiness** contra `/health`.
- **Pod Security Standards "restricted"**: no root, sistema de archivos de solo lectura,
  sin capabilities, `seccomp: RuntimeDefault`, sin token de ServiceAccount.
- **Rolling updates sin caída** (`maxUnavailable: 0`) y **PodDisruptionBudget**.
- **HPA** (autoescalado por CPU) opcional.
- **topologySpreadConstraints**: reparte las réplicas entre nodos (Raspberry Pi y PC).
- **Ingress** opcional (Traefik en k3s) y **ServiceMonitor** opcional para Prometheus Operator.
- **`helm test`**: verifica `/health`, `/info` y `/metrics` desde dentro del clúster.

En cada PR, el pipeline crea un **clúster k3s real de 3 nodos** (k3d), despliega el chart con
3 réplicas, ejecuta `helm test` y hace un rolling update.

Probarlo en local (requiere Docker, [k3d](https://k3d.io) y Helm):

```bash
make cluster      # clúster k3s de 3 nodos
make deploy       # build + import + helm install
make helm-test
make cluster-delete
```

### 🔄 GitOps con ArgoCD

Tras cada merge a `main`, el job `gitops` escribe en `chart/devops-api/values-homelab.yaml`
la versión exacta de la imagen (`sha-xxxxxxx`). ArgoCD, instalado en el clúster, detecta el
cambio en Git y lo despliega. **Nadie necesita acceso al clúster para desplegar.**

Puesta en marcha en el homelab (una sola vez):

```bash
# 1. Instalar ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 2. Registrar la aplicación
kubectl apply -f deploy/argocd/application.yaml
```

| Situación | Qué hace ArgoCD |
|---|---|
| Merge a `main` | Despliega la nueva versión automáticamente |
| Alguien cambia algo a mano en el clúster | Lo revierte (`selfHeal`) |
| Un recurso se elimina del chart | Lo borra del clúster (`prune`) |
| Hay que volver atrás | `git revert` del commit → ArgoCD despliega la versión anterior |

## Releases

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Publica `ghcr.io/ea-etn/devops-api:0.1.0` y `:0.1`, con SBOM y firma.

| Evento | Etiquetas de imagen |
|---|---|
| Pull request | (no se publica) |
| Push a `main` | `main`, `sha-xxxxxxx` |
| Tag `v1.2.3` | `1.2.3`, `1.2`, `sha-xxxxxxx` |

## Estructura

```
.
├── app/                         # Código de la API (FastAPI)
├── tests/                       # Tests (pytest)
├── chart/devops-api/            # Helm chart
│   ├── values.yaml              #   valores por defecto
│   └── values-homelab.yaml      #   entorno homelab (actualizado por GitOps)
├── deploy/argocd/               # Aplicación ArgoCD
├── .github/workflows/ci.yml     # Pipeline CI/CD
├── .github/dependabot.yml       # Actualizaciones automáticas
├── Dockerfile
└── Makefile
```

## Lecciones aprendidas

Incidentes reales encontrados al construir este proyecto, con causa y solución:

| Problema | Causa | Solución |
|---|---|---|
| `docker build` falla con **429 Too Many Requests** | Límite de descargas anónimas de Docker Hub | Usar un mirror (`mirror.gcr.io`) para la imagen base |
| `pip` falla dentro del build: *certificate verify failed* | Un proxy corporativo intercepta HTTPS | Inyectar la CA del proxy **solo** en la etapa de build local, nunca en la imagen final |
| `trivy-action` falla al instalar Trivy | El script de instalación no podía descargar el binario | Ejecutar la imagen oficial de Trivy **fijada por digest** (además, más seguro) |
| El rolling update falla: *annotations: expected string* | El chart no convertía a texto anotaciones numéricas | `quote` en la plantilla; lo detectó el test E2E en k3s |
| En `main` fallan Trivy y Cosign: *could not parse reference* | `github.repository` conserva mayúsculas (`EA-etn`) y Docker exige minúsculas | Normalizar el nombre con `${IMAGE,,}`. Los pasos que solo corren en `main` también necesitan cobertura |
| El release no ejecuta el pipeline | El tag apuntaba a un commit cuyo mensaje contenía la marca para **omitir CI**; GitHub también lee el título del PR en el commit de merge | Quitar la marca del commit del bot (los push con `GITHUB_TOKEN` no disparan workflows) y no usarla en títulos de PR |

## Próximos pasos

- [ ] Homelab k3s (Raspberry Pi + PC) con ArgoCD
- [ ] Observabilidad: Prometheus + Grafana + SLOs
- [ ] Infraestructura cloud con Terraform (GKE/EKS)
