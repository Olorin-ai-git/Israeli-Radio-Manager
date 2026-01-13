# Test Israeli Radio Command

Run backend and frontend tests for Israeli Radio Manager.

## Usage

```bash
/test-radio [component] [--coverage]
```

## Arguments

- **component** - `backend`, `frontend`, or `all` (default: all)
- **--coverage** - Generate coverage reports (default: true)

## Examples

### Run All Tests
```bash
/test-radio
```

### Backend Only
```bash
/test-radio backend
```

### Frontend with Coverage
```bash
/test-radio frontend --coverage
```

## Commands Executed

### Backend Tests
```bash
cd backend
poetry run pytest \
  --cov=app \
  --cov-report=html \
  --cov-report=term \
  -v \
  tests/
```

### Frontend Tests
```bash
cd frontend
npm test -- --coverage
```

## Prerequisites

- Poetry installed (backend)
- npm dependencies installed (frontend)
- MongoDB test database running
- Test fixtures in `backend/tests/conftest.py`

## Related Files

- `backend/pyproject.toml` - Test configuration
- `backend/tests/` - Backend test suite
- `frontend/vitest.config.ts` - Frontend test config
- `frontend/src/**/__tests__/` - Component tests
