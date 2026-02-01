#!/bin/bash
# Database migration script
# Usage: ./scripts/migrate.sh {up|down|new|history|current|heads}

set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Activate virtual environment if it exists
activate_venv() {
  if [ -d "$BACKEND_DIR/venv" ]; then
    source "$BACKEND_DIR/venv/bin/activate"
  elif [ -d "$BACKEND_DIR/.venv" ]; then
    source "$BACKEND_DIR/.venv/bin/activate"
  fi
}

cd "$BACKEND_DIR"
activate_venv

case "$1" in
  up|upgrade)
    echo "Upgrading database to latest migration..."
    alembic upgrade head
    echo "✓ Database upgraded"
    ;;

  down|downgrade)
    if [ -n "$2" ]; then
      echo "Downgrading database by $2 revision(s)..."
      alembic downgrade -"$2"
    else
      echo "Downgrading database by 1 revision..."
      alembic downgrade -1
    fi
    echo "✓ Database downgraded"
    ;;

  new|create)
    if [ -z "$2" ]; then
      echo "Error: Please provide a migration message"
      echo "Usage: ./scripts/migrate.sh new \"description of changes\""
      exit 1
    fi
    echo "Creating new migration: $2"
    alembic revision --autogenerate -m "$2"
    echo "✓ Migration created"
    echo ""
    echo "Review the generated migration in: backend/alembic/versions/"
    ;;

  history)
    echo "Migration history:"
    alembic history
    ;;

  current)
    echo "Current migration state:"
    alembic current
    ;;

  heads)
    echo "Migration heads:"
    alembic heads
    ;;

  stamp)
    if [ -z "$2" ]; then
      echo "Error: Please provide a revision to stamp"
      echo "Usage: ./scripts/migrate.sh stamp <revision>"
      exit 1
    fi
    echo "Stamping database with revision: $2"
    alembic stamp "$2"
    echo "✓ Database stamped"
    ;;

  *)
    echo "Uniformes System - Database Migrations"
    echo ""
    echo "Usage: ./scripts/migrate.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  up, upgrade     Apply all pending migrations"
    echo "  down, downgrade Rollback migration (default: 1, or specify number)"
    echo "  new, create     Create new migration with autogenerate"
    echo "  history         Show migration history"
    echo "  current         Show current migration state"
    echo "  heads           Show migration heads"
    echo "  stamp           Stamp database with specific revision"
    echo ""
    echo "Examples:"
    echo "  ./scripts/migrate.sh up"
    echo "  ./scripts/migrate.sh down 2"
    echo "  ./scripts/migrate.sh new \"add users table\""
    ;;
esac
