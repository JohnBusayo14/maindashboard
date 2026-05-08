import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthCtx = createContext(null);

const API_KEY = 'gofamint_admin_api_url';
const KEY_KEY = 'gofamint_admin_key';

const DEFAULT_API = import.meta.env.VITE_API_URL || 'https://api.gospelar.com';

export function AuthProvider({ children }) {
  const [api, setApi] = useState(() => localStorage.getItem(API_KEY) || DEFAULT_API);
  const [key, setKey] = useState(() => localStorage.getItem(KEY_KEY) || '');

  const signIn = useCallback((apiUrl, adminKey) => {
    const cleanApi = apiUrl.trim().replace(/\/$/, '');
    localStorage.setItem(API_KEY, cleanApi);
    localStorage.setItem(KEY_KEY, adminKey);
    setApi(cleanApi);
    setKey(adminKey);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY_KEY);
    setKey('');
  }, []);

  return (
    <AuthCtx.Provider value={{ api, key, isAuthed: !!key, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
