// frontend/src/hooks/useConfig.js
import { useContext } from 'react';
import { ConfigContext } from '../context/ConfigContext';

export const useConfig = () => {
  return useContext(ConfigContext);
};