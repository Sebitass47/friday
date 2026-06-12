#!/bin/bash
echo "Corriendo migraciones..."
alembic upgrade head
echo "Iniciando servidor..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload