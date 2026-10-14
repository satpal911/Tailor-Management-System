import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { unwrap } from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(unwrap(r).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const signIn = useCallback(async (path, values) => {
    const r = await api.post(path, values);
    setUser(unwrap(r).user);
    return unwrap(r).user;
  }, []);
  const login = useCallback((values) => signIn('/auth/login', values), [signIn]);
  const loginAdmin = useCallback((values) => signIn('/auth/admin/login', values), [signIn]);
  const loginTailor = useCallback((values) => signIn('/auth/tailor/login', values), [signIn]);
  const loginCustomer = useCallback((values) => signIn('/auth/customer/login', values), [signIn]);
  const registerCustomer = useCallback(
    (values) => signIn('/auth/customer/register', values),
    [signIn],
  );
  const registerTailor = useCallback((values) => api.post('/auth/tailor/register', values), []);
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginAdmin,
      loginTailor,
      loginCustomer,
      registerCustomer,
      registerTailor,
      logout,
      refresh,
    }),
    [
      user,
      loading,
      login,
      loginAdmin,
      loginTailor,
      loginCustomer,
      registerCustomer,
      registerTailor,
      logout,
      refresh,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
