FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY packages/shared/ /tmp/shared/
RUN pip install --no-cache-dir /tmp/shared/ && rm -rf /tmp/shared/

COPY simulator/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .

COPY simulator/src/ ./src/
COPY data/ ./data/

EXPOSE 9091

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9091/health || exit 1

CMD ["python", "-m", "src.main"]
