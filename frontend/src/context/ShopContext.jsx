import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api.js';

const ShopContext = createContext('Stitchcraft Atelier');

export function ShopProvider({ children }) {
  const [shopName, setShopName] = useState('Stitchcraft Atelier');
  useEffect(() => {
    let active = true;
    api
      .get('/shop')
      .then((response) => {
        if (active && response.data?.data?.name) setShopName(response.data.data.name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.title = `${shopName} · Tailoring`;
  }, [shopName]);
  return <ShopContext.Provider value={shopName}>{children}</ShopContext.Provider>;
}

export const useShopName = () => useContext(ShopContext);
