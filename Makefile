# Atajos para el día a día. Ejecuta `make help` para ver los comandos.
IMAGE   ?= devops-api
TAG     ?= local
CHART   := chart/devops-api
CLUSTER ?= devops-lab

.PHONY: help install lint format test run docker-build docker-run scan \
        helm-lint cluster deploy helm-test cluster-delete

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Crea el entorno virtual e instala dependencias
	python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

lint: ## Revisa el código (ruff)
	.venv/bin/ruff check . && .venv/bin/ruff format --check .

format: ## Formatea el código
	.venv/bin/ruff format . && .venv/bin/ruff check --fix .

test: ## Ejecuta los tests
	.venv/bin/pytest -v

run: ## Arranca la API en local con recarga automática
	.venv/bin/uvicorn app.main:app --reload

docker-build: ## Construye la imagen Docker
	docker build -t $(IMAGE):$(TAG) --build-arg APP_VERSION=$(TAG) .

docker-run: ## Arranca la imagen en http://localhost:8000
	docker run --rm -p 8000:8000 $(IMAGE):$(TAG)

scan: ## Escanea código e imagen con Trivy
	trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --ignore-unfixed .
	trivy image --severity HIGH,CRITICAL --ignore-unfixed $(IMAGE):$(TAG)

helm-lint: ## Valida el chart de Helm
	helm lint $(CHART) --strict
	helm template t $(CHART) | kubeconform -strict -summary -ignore-missing-schemas

cluster: ## Crea un clúster k3s local de 3 nodos (k3d)
	k3d cluster create $(CLUSTER) --agents 2 --wait

deploy: docker-build ## Despliega la imagen local en el clúster k3d
	k3d image import $(IMAGE):$(TAG) -c $(CLUSTER)
	helm upgrade --install devops-api $(CHART) \
	  --set image.repository=$(IMAGE) --set image.tag=$(TAG) --set image.pullPolicy=Never \
	  --wait --timeout 3m
	kubectl get pods -o wide -l app.kubernetes.io/name=devops-api

helm-test: ## Ejecuta los tests del chart contra el despliegue
	helm test devops-api --logs

cluster-delete: ## Borra el clúster local
	k3d cluster delete $(CLUSTER)
