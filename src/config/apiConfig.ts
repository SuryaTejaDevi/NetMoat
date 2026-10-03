export const getApiUrl = (endpoint: string) => {
    const isProd = import.meta.env.PROD;
    // In production, we assume the frontend is served by the backend on the same origin
    const baseUrl = isProd ? '' : 'http://localhost:3001';

    // Ensure endpoint starts with a slash
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${baseUrl}${cleanEndpoint}`;
};
