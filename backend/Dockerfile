FROM python:3.13-slim AS builder
WORKDIR /app

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --user -r requirements.txt

FROM python:3.13-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/root/.local/bin:$PATH

COPY --from=builder /root/.local /root/.local

COPY app ./app
COPY eval ./eval

# Best-effort: bake the embedding model into the image to avoid re-downloading
# on cold start. If this fails (e.g. HuggingFace unreachable at build time) the
# build still succeeds and fastembed downloads the model lazily at runtime.
RUN python - <<'EOF' || true
try:
    from fastembed import TextEmbedding
    TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    print("fastembed model preloaded into image")
except Exception as exc:  # noqa: BLE001
    print("model preload skipped:", exc)
EOF

CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"
