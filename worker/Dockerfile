# ACHARYA worker: FastAPI + WeasyPrint + sentence-transformers.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models TRANSFORMERS_OFFLINE=0

# WeasyPrint (Pango/Cairo/HarfBuzz) + fonts for Devanagari PDFs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libcairo2 libgdk-pixbuf-2.0-0 \
      libffi8 shared-mime-info fonts-noto-core fonts-noto-ui-core curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Bake the embedding model into the image so cold starts don't download it.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY app ./app
COPY templates ./templates

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fs http://127.0.0.1:8000/healthz || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
