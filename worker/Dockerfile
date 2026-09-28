FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY packages/shared/ /tmp/shared/
RUN pip install --no-cache-dir /tmp/shared/ && rm -rf /tmp/shared/

COPY worker/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir .

COPY worker/src/ ./src/
COPY data/ ./data/

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:9090/metrics || exit 1

CMD ["python", "-m", "src.main"]
