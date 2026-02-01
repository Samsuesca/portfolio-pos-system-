import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let cachedToken: string | null = null;

/**
 * Get public viewer token for catalog access
 * This token is cached and reused until it expires
 */
export async function getPublicToken(): Promise<string> {
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }

  try {
    // Login as public-viewer
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      username: 'public-viewer',
      password: 'Public2025'
    });

    // Backend returns { token: { access_token, ... }, user: {...} }
    cachedToken = response.data.token.access_token;
    if (!cachedToken) {
      throw new Error('Token not received from server');
    }
    return cachedToken;
  } catch (error) {
    console.error('Failed to get public token:', error);
    throw new Error('Failed to authenticate for catalog access');
  }
}

/**
 * Clear cached token (useful when token expires)
 */
export function clearPublicToken() {
  cachedToken = null;
}
