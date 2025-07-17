"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface ConfigContextType {
  apiKey: string | null;
  dbUrl: string | null;
  customInstructions: string | null;
  setApiKey: (key: string) => void;
  setDbUrl: (url: string) => void;
  setCustomInstructions: (instructions: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [dbUrl, setDbUrlState] = useState<string | null>(null);
  const [customInstructions, setCustomInstructionsState] = useState<
    string | null
  >(null);

  useEffect(() => {
    // Load from localStorage on client-side
    setApiKeyState(localStorage.getItem("gemini-key"));
    setDbUrlState(localStorage.getItem("postgres-db-url"));
    setCustomInstructionsState(localStorage.getItem("custom-instructions"));
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
  };

  const setDbUrl = (url: string) => {
    setDbUrlState(url);
  };

  const setCustomInstructions = (instructions: string) => {
    setCustomInstructionsState(instructions);
  };

  return (
    <ConfigContext.Provider
      value={{
        apiKey,
        dbUrl,
        customInstructions,
        setApiKey,
        setDbUrl,
        setCustomInstructions,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
