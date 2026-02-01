#!/bin/bash
# Test runner script
# Usage: ./scripts/test.sh {all|unit|api|integration|cov} [additional pytest args]

set -e

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.dev.yml"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Check if PostgreSQL is running
check_postgres() {
  if ! docker ps | grep -q uniformes-postgres; then
    echo "⚠ PostgreSQL is not running. Starting it..."
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5

    # Wait for health check
    for i in {1..30}; do
      if docker exec uniformes-postgres pg_isready -U uniformes_user -d uniformes_db > /dev/null 2>&1; then
        echo "✓ PostgreSQL is ready"
        break
      fi
      sleep 1
    done
  fi
}

# Activate virtual environment if it exists
activate_venv() {
  if [ -d "$BACKEND_DIR/venv" ]; then
    source "$BACKEND_DIR/venv/bin/activate"
  elif [ -d "$BACKEND_DIR/.venv" ]; then
    source "$BACKEND_DIR/.venv/bin/activate"
  fi
}

# Run tests
run_tests() {
  cd "$BACKEND_DIR"
  activate_venv
  pytest "$@"
}

case "$1" in
  all)
    check_postgres
    echo "Running all tests..."
    run_tests
    ;;

  unit)
    check_postgres
    echo "Running unit tests..."
    run_tests -m unit "${@:2}"
    ;;

  api)
    check_postgres
    echo "Running API tests..."
    run_tests -m api "${@:2}"
    ;;

  integration)
    check_postgres
    echo "Running integration tests..."
    run_tests -m integration "${@:2}"
    ;;

  cov|coverage)
    check_postgres
    echo "Running tests with coverage..."
    run_tests --cov=app --cov-report=html --cov-report=term "${@:2}"
    echo ""
    echo "✓ Coverage report generated at: backend/htmlcov/index.html"
    ;;

  watch)
    check_postgres
    echo "Running tests in watch mode..."
    run_tests --watch "${@:2}"
    ;;

  fast)
    check_postgres
    echo "Running tests (fail fast)..."
    run_tests -x "${@:2}"
    ;;

  verbose)
    check_postgres
    echo "Running tests (verbose)..."
    run_tests -v "${@:2}"
    ;;

  "")
    check_postgres
    echo "Running all tests..."
    run_tests
    ;;

  *)
    # Pass through any other arguments to pytest
    check_postgres
    run_tests "$@"
    ;;
esac
