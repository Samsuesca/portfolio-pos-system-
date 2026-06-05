import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissionsRefresh } from './usePermissionsRefresh';

vi.mock('../stores/authStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('../services/permissionRegistryService', () => ({
  checkPermissionsRefresh: vi.fn(),
}));

import { useAuthStore } from '../stores/authStore';
import { checkPermissionsRefresh } from '../services/permissionRegistryService';

const authMock = vi.mocked(useAuthStore as unknown as (s?: any) => any);
const checkMock = vi.mocked(checkPermissionsRefresh);

const mockUpdateUser = vi.fn();
const mockUser = { id: 'user-1', permissions_version: 5, school_roles: [] };

function setupAuthenticated() {
  authMock.mockImplementation((selector?: (s: any) => any) => {
    const state = {
      user: mockUser,
      isAuthenticated: true,
      updateUser: mockUpdateUser,
    };
    return selector ? selector(state) : state;
  });
}

function setupUnauthenticated() {
  authMock.mockImplementation((selector?: (s: any) => any) => {
    const state = { user: null, isAuthenticated: false, updateUser: mockUpdateUser };
    return selector ? selector(state) : state;
  });
}

describe('usePermissionsRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    checkMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not set interval when not authenticated', () => {
    setupUnauthenticated();
    const setIntervalSpy = vi.spyOn(globalThis,'setInterval');
    renderHook(() => usePermissionsRefresh());
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('sets a 60s interval when authenticated', () => {
    setupAuthenticated();
    const setIntervalSpy = vi.spyOn(globalThis,'setInterval');
    renderHook(() => usePermissionsRefresh());
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
  });

  it('calls checkPermissionsRefresh with user permissions_version after interval', async () => {
    setupAuthenticated();
    checkMock.mockResolvedValue({ status: 'current' });
    renderHook(() => usePermissionsRefresh());

    await vi.advanceTimersByTimeAsync(60_000);

    expect(checkMock).toHaveBeenCalledWith(5);
  });

  it('calls updateUser when status is stale', async () => {
    setupAuthenticated();
    const newRoles = [{ school_id: 'school-1', role: 'admin' }];
    checkMock.mockResolvedValue({
      status: 'stale',
      permissions_version: 6,
      school_roles: newRoles,
    });
    renderHook(() => usePermissionsRefresh());

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockUpdateUser).toHaveBeenCalledWith({
      permissions_version: 6,
      school_roles: newRoles,
    });
  });

  it('does not call updateUser when status is current', async () => {
    setupAuthenticated();
    checkMock.mockResolvedValue({ status: 'current' });
    renderHook(() => usePermissionsRefresh());

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('silently handles checkPermissionsRefresh returning null', async () => {
    setupAuthenticated();
    checkMock.mockResolvedValue(null);
    renderHook(() => usePermissionsRefresh());

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('uses 0 when permissions_version is undefined', async () => {
    const userNoVersion = { id: 'user-1', school_roles: [] };
    authMock.mockImplementation((selector?: (s: any) => any) => {
      const state = { user: userNoVersion, isAuthenticated: true, updateUser: mockUpdateUser };
      return selector ? selector(state) : state;
    });
    checkMock.mockResolvedValue({ status: 'current' });
    renderHook(() => usePermissionsRefresh());

    await vi.advanceTimersByTimeAsync(60_000);

    expect(checkMock).toHaveBeenCalledWith(0);
  });

  it('clears existing interval when auth changes to unauthenticated', () => {
    setupAuthenticated();
    const clearIntervalSpy = vi.spyOn(globalThis,'clearInterval');
    const { rerender } = renderHook(() => usePermissionsRefresh());

    setupUnauthenticated();
    rerender();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('clears interval on unmount', () => {
    setupAuthenticated();
    const clearIntervalSpy = vi.spyOn(globalThis,'clearInterval');
    const { unmount } = renderHook(() => usePermissionsRefresh());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
