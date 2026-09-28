FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN VITE_CONFERENCE=1 VITE_SHOWCASE=0 npm run build

FROM python:3.12-slim-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libreoffice-impress fonts-dejavu-core libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock && pip check
COPY app/ ./app/
COPY config/ ./config/
COPY examples/ ./examples/
COPY frontend/src/assets/fonts/ ./frontend/src/assets/fonts/
COPY --from=frontend /build/frontend/dist/ ./frontend/dist-conference/
RUN useradd --create-home --uid 10001 presenter && chown -R presenter:presenter /app
USER presenter
ENV SDA_PROFILE=conference DEV_MODE=false SDA_CONFERENCE_MAX_RUNS=0 PYTHONDONTWRITEBYTECODE=1
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
