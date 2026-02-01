#!/bin/bash
# Development environment management script
# Usage: ./scripts/dev.sh {up|down|restart|logs|ps|db|test-db|clean}

set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.dev.yml"

case "$1" in
  up)
    echo "Starting development environment..."
    docker-compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "✓ Development environment started"
    echo "  - Backend API: http://localhost:8000"
    echo "  - API Docs:    http://localhost:8000/docs"
    echo "  - PostgreSQL:  localhost:5432"
    echo "  - Redis:       localhost:6379"
    echo ""
    echo "Run './scripts/dev.sh logs' to see container logs"
    ;;

  down)
    echo "Stopping development environment..."
    docker-compose -f "$COMPOSE_FILE" down
    echo "✓ Development environment stopped"
    ;;

  restart)
    echo "Restarting development environment..."
    docker-compose -f "$COMPOSE_FILE" restart ${2:-}
    echo "✓ Restart complete"
    ;;

  logs)
    docker-compose -f "$COMPOSE_FILE" logs -f ${2:-}
    ;;

  ps)
    docker-compose -f "$COMPOSE_FILE" ps
    ;;

  db)
    echo "Connecting to development database..."
    docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_db
    ;;

  test-db)
    echo "Connecting to test database..."
    docker exec -it uniformes-postgres psql -U uniformes_user -d uniformes_test
    ;;

  shell)
    echo "Opening shell in backend container..."
    docker exec -it uniformes-backend /bin/bash
    ;;

  clean)
    echo "Stopping and removing all containers and volumes..."
    docker-compose -f "$COMPOSE_FILE" down -v
    echo "✓ Containers and volumes removed"
    echo ""
    echo "Note: Run './scripts/dev.sh up' to start fresh"
    ;;

  build)
    echo "Rebuilding containers..."
    docker-compose -f "$COMPOSE_FILE" build ${2:-}
    echo "✓ Build complete"
    ;;

  *)
    echo "Uniformes System - Development Environment"
    echo ""
    echo "Usage: ./scripts/dev.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  up        Start all containers"
    echo "  down      Stop all containers"
    echo "  restart   Restart containers (optionally specify service)"
    echo "  logs      View container logs (optionally specify service)"
    echo "  ps        List running containers"
    echo "  db        Connect to development PostgreSQL"
    echo "  test-db   Connect to test PostgreSQL"
    echo "  shell     Open shell in backend container"
    echo "  build     Rebuild containers"
    echo "  clean     Remove containers and volumes (data loss!)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/dev.sh up"
    echo "  ./scripts/dev.sh logs backend"
    echo "  ./scripts/dev.sh restart postgres"
    ;;
esac
