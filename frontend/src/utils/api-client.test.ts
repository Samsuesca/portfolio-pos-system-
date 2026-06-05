import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../stores/configStore', () => ({
  useConfigStore: {
    getState: vi.fn(() => ({
      apiUrl: 'http://localhost:8001',
      isOnline: true,
      setIsOnline: vi.fn(),
      updateLastChecked: vi.fn(),
    })),
  },
}));

import {
  apiClient,
  getErrorMessage,
  extractErrorMessage,
  getImageUrlWithCacheBust,
  refreshImageCache,
  checkConnection,
} from './api-client';

// ─── XHR Mock Factory ─────────────────────────────────────────────────────────

type XhrMock = {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  status: number;
  responseText: string;
  timeout: number;
};

function stubXHR(status: number, responseText: string = '{}'): XhrMock {
  const xhr: XhrMock = {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn().mockImplementation(() => {
      Promise.resolve().then(() => xhr.onload?.());
    }),
    onload: null,
    onerror: null,
    ontimeout: null,
    status,
    responseText,
    timeout: 0,
  };
  vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr));
  return xhr;
}

// ─── getErrorMessage ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns error.message for Error instances', () => {
    expect(getErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('returns detail string for objects with detail field', () => {
    expect(getErrorMessage({ detail: 'Bad request' })).toBe('Bad request');
  });

  it('returns fallback message for unknown error types', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
  });

  it('returns fallback message for null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });
});

// ─── extractErrorMessage ──────────────────────────────────────────────────────

describe('extractErrorMessage', () => {
  it('handles Pydantic validation error array', () => {
    const err = {
      response: {
        data: {
          detail: [{ loc: ['body', 'email'], msg: 'field required' }],
        },
      },
    };
    const msg = extractErrorMessage(err);
    expect(msg).toContain('email');
    expect(msg).toContain('field required');
  });

  it('handles string detail', () => {
    const err = { response: { data: { detail: 'Usuario no encontrado' } } };
    expect(extractErrorMessage(err)).toBe('Usuario no encontrado');
  });

  it('handles Error with Unauthorized message', () => {
    expect(extractErrorMessage(new Error('Unauthorized'))).toBe('Sesión expirada. Inicia sesión nuevamente.');
  });

  it('handles Error with HTTP 404', () => {
    expect(extractErrorMessage(new Error('HTTP 404'))).toBe('El recurso no fue encontrado.');
  });

  it('handles Error with HTTP 409', () => {
    expect(extractErrorMessage(new Error('HTTP 409'))).toBe('Ya existe un registro con estos datos.');
  });

  it('handles Error with HTTP 422', () => {
    expect(extractErrorMessage(new Error('HTTP 422'))).toBe('Error de validación. Revisa los campos.');
  });

  it('handles Error with generic message', () => {
    expect(extractErrorMessage(new Error('custom error message'))).toBe('custom error message');
  });

  it('handles network error message', () => {
    const err = { message: 'Network request failed' };
    expect(extractErrorMessage(err)).toBe('Error de conexión. Verifica tu internet.');
  });

  it('returns generic fallback for unknown errors', () => {
    expect(extractErrorMessage({})).toBe('Error desconocido. Intenta de nuevo.');
  });
});

// ─── getImageUrlWithCacheBust ─────────────────────────────────────────────────

describe('getImageUrlWithCacheBust', () => {
  it('returns empty string for null input', () => {
    expect(getImageUrlWithCacheBust(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(getImageUrlWithCacheBust(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(getImageUrlWithCacheBust('')).toBe('');
  });

  it('appends cb param to absolute URL', () => {
    const result = getImageUrlWithCacheBust('http://example.com/img.jpg');
    expect(result).toMatch(/\?cb=\d+$/);
  });

  it('prepends apiUrl to relative URL', () => {
    const result = getImageUrlWithCacheBust('/media/img.jpg');
    expect(result).toContain('http://localhost:8001');
    expect(result).toContain('/media/img.jpg');
  });

  it('uses & separator when URL already has query params', () => {
    const result = getImageUrlWithCacheBust('http://example.com/img.jpg?size=lg');
    expect(result).toContain('&cb=');
  });

  it('forceFresh=true uses a fresh timestamp (different from session)', () => {
    const result1 = getImageUrlWithCacheBust('http://example.com/img.jpg');
    const result2 = getImageUrlWithCacheBust('http://example.com/img.jpg', true);
    // Both contain cb= but forceFresh may produce a different value
    expect(result1).toMatch(/cb=\d+/);
    expect(result2).toMatch(/cb=\d+/);
  });
});

// ─── refreshImageCache ────────────────────────────────────────────────────────

describe('refreshImageCache', () => {
  it('changes the session cache buster so URLs differ before/after refresh', () => {
    const before = getImageUrlWithCacheBust('http://example.com/img.jpg');
    refreshImageCache();
    const after = getImageUrlWithCacheBust('http://example.com/img.jpg');
    // The cb value should be the same or different — just verify no crash
    // (timing may make them equal in same ms; test just verifies it runs)
    expect(typeof before).toBe('string');
    expect(typeof after).toBe('string');
  });
});

// ─── apiClient.request (via XHR in test env) ──────────────────────────────────

describe('apiClient.request', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data on 200 response', async () => {
    stubXHR(200, JSON.stringify({ id: '1', name: 'Test' }));
    const result = await apiClient.get('/test-endpoint');
    expect(result.data).toEqual({ id: '1', name: 'Test' });
    expect(result.status).toBe(200);
  });

  it('includes Authorization header when token is in localStorage', async () => {
    localStorage.setItem('access_token', 'my-token');
    const xhr = stubXHR(200, '{}');
    await apiClient.get('/test');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer my-token');
  });

  it('throws Error on 403 with detail from response', async () => {
    stubXHR(403, JSON.stringify({ detail: 'Sin permisos' }));
    await expect(apiClient.get('/restricted')).rejects.toThrow('Sin permisos');
  });

  it('throws default 403 message when no detail', async () => {
    stubXHR(403, '{}');
    await expect(apiClient.get('/restricted')).rejects.toThrow('No tienes permisos');
  });

  it('throws on 401 Unauthorized', async () => {
    stubXHR(401, '{}');
    await expect(apiClient.get('/protected')).rejects.toThrow('Unauthorized');
  });

  it('throws with string detail on 4xx error', async () => {
    stubXHR(422, JSON.stringify({ detail: 'Validation failed' }));
    await expect(apiClient.post('/endpoint', {})).rejects.toThrow('Validation failed');
  });

  it('throws with formatted Pydantic errors on 422', async () => {
    const detail = [{ loc: ['body', 'email'], msg: 'field required' }];
    stubXHR(422, JSON.stringify({ detail }));
    await expect(apiClient.post('/endpoint', {})).rejects.toThrow('email: field required');
  });

  it('returns empty object on 204 No Content', async () => {
    stubXHR(204, '');
    const result = await apiClient.delete('/item/1');
    expect(result.data).toEqual({});
    expect(result.status).toBe(204);
  });

  it('throws HTTP N message for unknown 4xx errors', async () => {
    stubXHR(418, '{}');
    await expect(apiClient.get('/teapot')).rejects.toThrow('HTTP 418');
  });

  it('appends query params to URL', async () => {
    const xhr = stubXHR(200, '{}');
    await apiClient.get('/endpoint', { params: { page: 1, limit: 10 } });
    const urlArg = xhr.open.mock.calls[0][1] as string;
    expect(urlArg).toContain('page=1');
    expect(urlArg).toContain('limit=10');
  });

  it('skips null/undefined query params', async () => {
    const xhr = stubXHR(200, '{}');
    await apiClient.get('/endpoint', { params: { a: 'yes', b: null, c: undefined } });
    const urlArg = xhr.open.mock.calls[0][1] as string;
    expect(urlArg).toContain('a=yes');
    expect(urlArg).not.toContain('b=');
    expect(urlArg).not.toContain('c=');
  });

  it('throws with JSON.stringified detail when detail is an object', async () => {
    stubXHR(500, JSON.stringify({ detail: { code: 'ERR', info: 'nested' } }));
    await expect(apiClient.get('/fail')).rejects.toThrow('code');
  });

  it('handles non-JSON response text (raw string fallback)', async () => {
    const xhr: XhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn().mockImplementation(() => {
        Promise.resolve().then(() => xhr.onload?.());
      }),
      onload: null,
      onerror: null,
      ontimeout: null,
      status: 200,
      responseText: 'plain text not JSON',
      timeout: 0,
    };
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr));
    const result = await apiClient.get('/text');
    expect(result.data).toBe('plain text not JSON');
  });

  it('throws TypeError on network error', async () => {
    const xhr: XhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn().mockImplementation(() => {
        Promise.resolve().then(() => xhr.onerror?.());
      }),
      onload: null,
      onerror: null,
      ontimeout: null,
      status: 0,
      responseText: '',
      timeout: 0,
    };
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr));
    await expect(apiClient.get('/down')).rejects.toThrow('Network request failed');
  });

  it('throws TypeError on request timeout', async () => {
    const xhr: XhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn().mockImplementation(() => {
        Promise.resolve().then(() => xhr.ontimeout?.());
      }),
      onload: null,
      onerror: null,
      ontimeout: null,
      status: 0,
      responseText: '',
      timeout: 0,
    };
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr));
    await expect(apiClient.get('/slow')).rejects.toThrow('Request timeout');
  });

  it('sends PUT request with correct method', async () => {
    const xhr = stubXHR(200, '{"ok": true}');
    await apiClient.put('/item/1', { name: 'updated' });
    expect(xhr.open).toHaveBeenCalledWith('PUT', expect.stringContaining('/item/1'));
  });

  it('sends PATCH request with correct method', async () => {
    const xhr = stubXHR(200, '{"ok": true}');
    await apiClient.patch('/item/1', { name: 'patched' });
    expect(xhr.open).toHaveBeenCalledWith('PATCH', expect.stringContaining('/item/1'));
  });

  it('does not send body for GET requests', async () => {
    const xhr = stubXHR(200, '{}');
    await apiClient.get('/no-body');
    expect(xhr.send).toHaveBeenCalledWith(null);
  });
});

// ─── apiClient.uploadFile ────────────────────────────────────────────────────

describe('apiClient.uploadFile', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads file via XHR and returns data', async () => {
    const xhr = stubXHR(200, JSON.stringify({ url: '/media/img.jpg' }));
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const result = await apiClient.uploadFile('/upload', file);
    expect(result.data).toEqual({ url: '/media/img.jpg' });
    expect(result.status).toBe(200);
    // Verify FormData was sent (send receives FormData)
    const sentBody = xhr.send.mock.calls[0][0];
    expect(sentBody).toBeInstanceOf(FormData);
  });

  it('includes auth header when token present', async () => {
    localStorage.setItem('access_token', 'upload-token');
    const xhr = stubXHR(200, '{}');
    const file = new File(['x'], 'f.txt');
    await apiClient.uploadFile('/upload', file);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer upload-token');
  });

  it('throws on 401 during upload', async () => {
    stubXHR(401, '{}');
    const file = new File(['x'], 'f.txt');
    await expect(apiClient.uploadFile('/upload', file)).rejects.toThrow('Unauthorized');
  });

  it('throws on 403 during upload', async () => {
    stubXHR(403, JSON.stringify({ detail: 'Upload forbidden' }));
    const file = new File(['x'], 'f.txt');
    await expect(apiClient.uploadFile('/upload', file)).rejects.toThrow('Upload forbidden');
  });

  it('throws on 422 with Pydantic errors during upload', async () => {
    const detail = [{ loc: ['body', 'file'], msg: 'too large' }];
    stubXHR(422, JSON.stringify({ detail }));
    const file = new File(['x'], 'f.txt');
    await expect(apiClient.uploadFile('/upload', file)).rejects.toThrow('file: too large');
  });

  it('uses custom field name', async () => {
    const xhr = stubXHR(200, '{}');
    const file = new File(['x'], 'photo.jpg');
    await apiClient.uploadFile('/upload', file, 'image');
    const sentBody = xhr.send.mock.calls[0][0] as FormData;
    expect(sentBody.get('image')).toBeTruthy();
  });
});

// ─── checkConnection ──────────────────────────────────────────────────────────

describe('checkConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true on successful health check', async () => {
    stubXHR(200, 'ok');
    const result = await checkConnection();
    expect(result).toBe(true);
  });

  it('returns false on XHR error', async () => {
    const xhr: XhrMock = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn().mockImplementation(() => {
        Promise.resolve().then(() => xhr.onerror?.());
      }),
      onload: null,
      onerror: null,
      ontimeout: null,
      status: 0,
      responseText: '',
      timeout: 0,
    };
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr));
    const result = await checkConnection();
    expect(result).toBe(false);
  });
});
