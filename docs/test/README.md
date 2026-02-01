# Testing

Documentacion de estrategias de testing y resultados.

---

## Contenido

| Documento | Descripcion |
|-----------|-------------|
| [testing-guide.md](./testing-guide.md) | Guia general de testing |
| [phase1-testing-guide.md](./phase1-testing-guide.md) | Guia de testing Phase 1 (LAN) |
| [phase1-results.md](./phase1-results.md) | Resultados de Phase 1 |

---

## Estado Actual de Tests

> **Ultima actualizacion:** 2026-01-19

### Backend (Python/pytest)

| Tipo | Archivos | Tests | Estado |
|------|----------|-------|--------|
| Unit tests | 22 | ~450 | 834 passed |
| API tests | 20 | ~380 | 61 skipped |
| Integration | 2 | ~65 | 0 failed |
| **Total** | 44 | **895** | **OK** |

**Nota sobre tests skipped:** 61 tests estan marcados como skip debido a problemas de aislamiento de base de datos cuando se ejecutan en la suite completa. Estos tests pasan correctamente cuando se ejecutan de forma aislada. El problema sera resuelto mejorando las fixtures de test.

### Frontend

- Framework: Vitest
- Estado: En expansion

---

## Ejecutar Tests

### Backend

```bash
cd backend
source venv/bin/activate
pytest
pytest --cov=app  # Con cobertura
```

### Frontend

```bash
cd frontend
npm run test
```

---

## Fases de Testing

| Fase | Descripcion | Estado |
|------|-------------|--------|
| Phase 1 | Testing LAN (Mac ↔ Windows) | Completado |
| Phase 2 | Testing con datos reales | En progreso |
| Phase 3 | Testing de carga | Pendiente |

---

[← Volver al indice](../README.md)
