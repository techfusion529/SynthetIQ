FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY packages/shared/ /tmp/shared/
RUN uv pip install --system /tmp/shared/ && rm -rf /tmp/shared/

COPY worker/pyproject.toml ./pyproject.toml
COPY worker/src/ ./src/
COPY data/ ./data/
RUN uv pip install --system .

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

CMD ["python", "-m", "src.main"]
