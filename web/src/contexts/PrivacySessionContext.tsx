import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";

interface PrivacySessionContextValue {
  unlocked: boolean;
  unlockAll: () => void;
  unlockMemo: (memoName: string) => void;
  lockAll: () => void;
  lockMemo: (memoName: string) => void;
  isMemoUnlocked: (memoName: string) => boolean;
}

const fallbackValue: PrivacySessionContextValue = {
  unlocked: false,
  unlockAll: () => undefined,
  unlockMemo: () => undefined,
  lockAll: () => undefined,
  lockMemo: () => undefined,
  isMemoUnlocked: () => false,
};

const PrivacySessionContext = createContext<PrivacySessionContextValue>(fallbackValue);

export const PrivacySessionProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const { privacyMode, requirePasswordForPrivateContent } = usePersonalFeatures();
  const [unlocked, setUnlocked] = useState(false);
  const [unlockedMemos, setUnlockedMemos] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setUnlocked(false);
  }, [currentUser?.name, privacyMode]);

  useEffect(() => {
    setUnlockedMemos(new Set());
  }, [currentUser?.name, requirePasswordForPrivateContent]);

  // Personal dashboards and tagged memos have independent verification sessions.
  const unlockAll = useCallback(() => setUnlocked(true), []);
  const lockAll = useCallback(() => setUnlocked(false), []);
  const unlockMemo = useCallback((memoName: string) => {
    setUnlockedMemos((current) => new Set(current).add(memoName));
  }, []);
  const lockMemo = useCallback((memoName: string) => {
    setUnlockedMemos((current) => {
      const next = new Set(current);
      next.delete(memoName);
      return next;
    });
  }, []);
  const isMemoUnlocked = useCallback((memoName: string) => unlockedMemos.has(memoName), [unlockedMemos]);

  const value = useMemo(
    () => ({ unlocked, unlockAll, unlockMemo, lockAll, lockMemo, isMemoUnlocked }),
    [isMemoUnlocked, lockAll, lockMemo, unlockAll, unlockMemo, unlocked],
  );

  return <PrivacySessionContext.Provider value={value}>{children}</PrivacySessionContext.Provider>;
};

export const usePrivacySession = () => useContext(PrivacySessionContext);
