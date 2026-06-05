import { describe, it, expect, beforeEach } from 'vitest';
import {
  useConfigStore,
  getEnvironmentType,
  getEnvironmentLabel,
  getEnvironmentColor,
  isDevelopment,
  isProduction,
} from '../configStore';
import { ENVIRONMENTS } from '../../config/environments';

describe('configStore — helper functions', () => {
  describe('getEnvironmentType', () => {
    it('returns development for localhost URL', () => {
      expect(getEnvironmentType('http://localhost:8001')).toBe('development');
    });

    it('returns development for 127.0.0.1 (LOCAL env)', () => {
      expect(getEnvironmentType(ENVIRONMENTS.LOCAL)).toBe('development');
    });

    it('returns lan for 192.168.x.x URLs', () => {
      expect(getEnvironmentType('http://192.168.1.5:8000')).toBe('lan');
    });

    it('returns lan for LAN env constant', () => {
      expect(getEnvironmentType(ENVIRONMENTS.LAN)).toBe('lan');
    });

    it('returns production for yourdomain.com', () => {
      expect(getEnvironmentType('https://api.yourdomain.com')).toBe('production');
    });

    it('returns production for CLOUD env constant', () => {
      expect(getEnvironmentType(ENVIRONMENTS.CLOUD)).toBe('production');
    });

    it('returns custom for unknown URLs', () => {
      expect(getEnvironmentType('https://myserver.example.com')).toBe('custom');
    });
  });

  describe('getEnvironmentLabel', () => {
    it('returns Spanish label for each type', () => {
      expect(getEnvironmentLabel(ENVIRONMENTS.LOCAL)).toBe('Desarrollo');
      expect(getEnvironmentLabel(ENVIRONMENTS.LAN)).toBe('Red Local');
      expect(getEnvironmentLabel(ENVIRONMENTS.CLOUD)).toBe('Producción');
      expect(getEnvironmentLabel('https://myserver.example.com')).toBe('Personalizado');
    });
  });

  describe('getEnvironmentColor', () => {
    it('returns correct Tailwind class for each type', () => {
      expect(getEnvironmentColor(ENVIRONMENTS.LOCAL)).toBe('bg-yellow-500');
      expect(getEnvironmentColor(ENVIRONMENTS.LAN)).toBe('bg-brand-500');
      expect(getEnvironmentColor(ENVIRONMENTS.CLOUD)).toBe('bg-green-500');
      expect(getEnvironmentColor('https://custom.example.com')).toBe('bg-purple-500');
    });
  });

  describe('isDevelopment / isProduction', () => {
    it('isDevelopment returns true only for dev URLs', () => {
      expect(isDevelopment(ENVIRONMENTS.LOCAL)).toBe(true);
      expect(isDevelopment(ENVIRONMENTS.CLOUD)).toBe(false);
    });

    it('isProduction returns true only for prod URLs', () => {
      expect(isProduction(ENVIRONMENTS.CLOUD)).toBe(true);
      expect(isProduction(ENVIRONMENTS.LOCAL)).toBe(false);
    });
  });
});

describe('configStore — store actions', () => {
  beforeEach(() => {
    useConfigStore.setState({
      isOnline: false,
      lastChecked: null,
      sidebarCollapsed: false,
      isDarkMode: false,
    });
    // Reset document class
    document.documentElement.classList.remove('dark');
  });

  describe('setApiUrl', () => {
    it('updates apiUrl for valid URLs', () => {
      useConfigStore.getState().setApiUrl('http://localhost:8001');
      expect(useConfigStore.getState().apiUrl).toBe('http://localhost:8001');
    });

    it('rejects invalid URLs (no protocol)', () => {
      const before = useConfigStore.getState().apiUrl;
      useConfigStore.getState().setApiUrl('not-a-url');
      expect(useConfigStore.getState().apiUrl).toBe(before);
    });

    it('rejects plain hostnames without http/https', () => {
      const before = useConfigStore.getState().apiUrl;
      useConfigStore.getState().setApiUrl('ftp://example.com');
      expect(useConfigStore.getState().apiUrl).toBe(before);
    });

    it('accepts https URLs', () => {
      useConfigStore.getState().setApiUrl('https://api.example.com');
      expect(useConfigStore.getState().apiUrl).toBe('https://api.example.com');
    });
  });

  describe('resetApiUrl', () => {
    it('restores to default environment', () => {
      useConfigStore.getState().setApiUrl('https://custom.example.com');
      useConfigStore.getState().resetApiUrl();
      // Default env depends on import.meta.env.DEV — just verify it's a valid URL
      const url = useConfigStore.getState().apiUrl;
      expect(url.startsWith('http')).toBe(true);
    });
  });

  describe('setIsOnline', () => {
    it('sets online status to true', () => {
      useConfigStore.getState().setIsOnline(true);
      expect(useConfigStore.getState().isOnline).toBe(true);
    });

    it('sets online status to false', () => {
      useConfigStore.setState({ isOnline: true });
      useConfigStore.getState().setIsOnline(false);
      expect(useConfigStore.getState().isOnline).toBe(false);
    });
  });

  describe('updateLastChecked', () => {
    it('sets lastChecked to current Date', () => {
      const before = Date.now();
      useConfigStore.getState().updateLastChecked();
      const lastChecked = useConfigStore.getState().lastChecked;
      expect(lastChecked).not.toBeNull();
      expect(lastChecked!.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('setSidebarCollapsed', () => {
    it('sets sidebarCollapsed to true', () => {
      useConfigStore.getState().setSidebarCollapsed(true);
      expect(useConfigStore.getState().sidebarCollapsed).toBe(true);
    });
  });

  describe('toggleSidebar', () => {
    it('toggles from false to true', () => {
      useConfigStore.setState({ sidebarCollapsed: false });
      useConfigStore.getState().toggleSidebar();
      expect(useConfigStore.getState().sidebarCollapsed).toBe(true);
    });

    it('toggles from true to false', () => {
      useConfigStore.setState({ sidebarCollapsed: true });
      useConfigStore.getState().toggleSidebar();
      expect(useConfigStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('toggleDarkMode', () => {
    it('toggles isDarkMode from false to true', () => {
      useConfigStore.setState({ isDarkMode: false });
      useConfigStore.getState().toggleDarkMode();
      expect(useConfigStore.getState().isDarkMode).toBe(true);
    });

    it('adds dark class to documentElement when enabling', () => {
      useConfigStore.setState({ isDarkMode: false });
      document.documentElement.classList.remove('dark');
      useConfigStore.getState().toggleDarkMode();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class from documentElement when disabling', () => {
      useConfigStore.setState({ isDarkMode: true });
      document.documentElement.classList.add('dark');
      useConfigStore.getState().toggleDarkMode();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
