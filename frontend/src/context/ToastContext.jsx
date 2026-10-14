import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
const C = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = (id) => setItems((v) => v.filter((x) => x.id !== id));
  const toast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setItems((v) => [...v, { id, message, type }]);
    setTimeout(() => remove(id), 3800);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <C.Provider value={value}>
      {children}
      <div className="toast-root" aria-live="polite">
        {items.map((t) => (
          <div className={`toast ${t.type}`} key={t.id}>
            {t.type === 'error' ? (
              <AlertCircle size={16} />
            ) : t.type === 'info' ? (
              <CheckCircle2 size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </C.Provider>
  );
}
export const useToast = () => useContext(C);
