import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPath, type Location, useBlocker, useLocation, useNavigate } from "react-router-dom";
import PrivacyUnlockDialog from "@/components/PrivacyUnlockDialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivacySession } from "@/contexts/PrivacySessionContext";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { ROUTES } from "@/router/routes";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy } from "@/types/proto/api/v1/user_service_pb";

const isPersonalPath = (pathname: string) =>
  [ROUTES.PERSONAL, ROUTES.REMINDERS, ROUTES.FINANCE, ROUTES.MOOD].some((path) => pathname === path || pathname === `${path}/`);

/** Verify at the navigation boundary, keeping the current page mounted until approval. */
const PersonalNavigationGuard = ({ children }: { children: ReactNode }) => {
  const { currentUser, isUserSettingsInitialized } = useAuth();
  const { privacyMode } = usePersonalFeatures();
  const { unlocked, unlockAll } = usePrivacySession();
  const location = useLocation();
  const navigate = useNavigate();
  const [directTarget, setDirectTarget] = useState<Location>();
  const approvedTarget = useRef<string | undefined>(undefined);
  const privacyEnabled = Boolean(
    currentUser && isUserSettingsInitialized && privacyMode !== UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE,
  );
  const blockEntry = useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: Location; nextLocation: Location }) => {
      if (approvedTarget.current === createPath(nextLocation)) {
        approvedTarget.current = undefined;
        return false;
      }
      return privacyEnabled && isPersonalPath(nextLocation.pathname) && !isPersonalPath(currentLocation.pathname);
    },
    [privacyEnabled],
  );
  const blocker = useBlocker(blockEntry);
  const personalPage = isPersonalPath(location.pathname);
  const directEntryLocked = personalPage && privacyEnabled && !unlocked;

  // A reload/deep link has no previous in-app page. Return to Home before
  // prompting, and retain the exact destination for successful verification.
  useEffect(() => {
    if (!directEntryLocked) return;
    setDirectTarget(location);
    navigate(ROUTES.HOME, { replace: true });
  }, [directEntryLocked, location, navigate]);

  const pending = blocker.state === "blocked" || Boolean(directTarget);
  const close = () => {
    if (blocker.state === "blocked") blocker.reset();
    setDirectTarget(undefined);
  };
  const proceed = () => {
    unlockAll();
    if (blocker.state === "blocked") {
      blocker.proceed();
    } else if (directTarget) {
      approvedTarget.current = createPath(directTarget);
      navigate(directTarget, { replace: true, state: directTarget.state });
      setDirectTarget(undefined);
    }
  };
  const settingsPending = Boolean(currentUser && !isUserSettingsInitialized);

  return (
    <>
      {!directEntryLocked && !(personalPage && settingsPending) && children}
      {pending && (
        <PrivacyUnlockDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          onUnlocked={proceed}
        />
      )}
    </>
  );
};

export default PersonalNavigationGuard;
