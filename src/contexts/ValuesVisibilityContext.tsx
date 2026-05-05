import { createContext, useState, useContext, ReactNode } from 'react';

interface ValuesVisibilityContextProps {
  valuesVisible: boolean;
  toggleValuesVisible: () => void;
}

export const ValuesVisibilityContext = createContext<ValuesVisibilityContextProps>({
  valuesVisible: true,
  toggleValuesVisible: () => {},
});

export function ValuesVisibilityProvider({ children }: { children: ReactNode }) {
  const [valuesVisible, setValuesVisible] = useState(true);
  const toggleValuesVisible = () => setValuesVisible(v => !v);
  return (
    <ValuesVisibilityContext.Provider value={{ valuesVisible, toggleValuesVisible }}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}