FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY packages/synthetiq-shared/ /tmp/synthetiq-shared/
RUN uv pip install --system /tmp/synthetiq-shared/ && rm -rf /tmp/synthetiq-shared/

COPY simulator/pyproject.toml ./pyproject.toml
COPY simulator/src/ ./src/
COPY data/ ./data/
RUN uv pip install --system .

EXPOSE 9091

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9091/health || exit 1

CMD ["python", "-m", "src.main"]
