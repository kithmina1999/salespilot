export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type FetchOptions = RequestInit & {
  requireAuth?: boolean;
};

export async function fetchApi(endpoint: string, options: FetchOptions = {}) {
  const { requireAuth = true, ...customConfig } = options;
  
  const headers = new Headers(customConfig.headers || {});
  headers.set('Content-Type', 'application/json');

  if (requireAuth) {
    const masterKey = typeof window !== 'undefined' ? sessionStorage.getItem('master_key') : null;
    if (!masterKey) {
      if (typeof window !== 'undefined') window.location.href = '/';
      throw new Error("No master key found");
    }
    headers.set('X-Master-Key', masterKey);
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (response.status === 401 && requireAuth) {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('master_key');
      window.location.href = '/';
    }
    throw new Error('Unauthorized - Invalid Master Key');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}
