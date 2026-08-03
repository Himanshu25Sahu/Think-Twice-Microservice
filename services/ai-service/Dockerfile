FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FASTEMBED_CACHE_PATH=/models

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Bake both models into the image. Downloading at boot instead would mean a
# slow, network-dependent cold start on every container restart.
RUN python -c "\
from fastembed import TextEmbedding; \
TextEmbedding(model_name='BAAI/bge-small-en-v1.5')"

RUN python -c "\
from fastembed.rerank.cross_encoder import TextCrossEncoder; \
TextCrossEncoder(model_name='Xenova/ms-marco-MiniLM-L-6-v2')"

COPY app ./app
COPY scripts ./scripts

EXPOSE 5005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5005"]
