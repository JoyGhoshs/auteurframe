#!/bin/sh
set -e
cd /app
exec python run.py --host "${AUTEUR_HOST:-0.0.0.0}" --port "${AUTEUR_PORT:-8800}"
