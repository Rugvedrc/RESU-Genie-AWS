# ================================
# RESU-GENIE - Backend Dockerfile
# ================================
# Multi-stage build for smaller final image

FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies (needed for PyMuPDF)
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    libssl-dev \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Create non-root user (security best practice)
RUN useradd --create-home --shell /bin/bash appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')"

# Start with Gunicorn (production WSGI server)
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--worker-class", "gthread", \
     "--threads", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info", \
     "app:app"]
