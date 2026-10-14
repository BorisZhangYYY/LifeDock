import { EyeIcon, LockIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import PrivacyUnlockDialog from "@/components/PrivacyUnlockDialog";
import { Button } from "@/components/ui/button";
import { usePrivacySession } from "@/contexts/PrivacySessionContext";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

const PersonalContent = ({ children }: { children: ReactNode }) => {
  const t = useTranslate();
  const { privacyMode, requirePasswordForPrivateContent } = usePersonalFeatures();
  const privacySession = usePrivacySession();
  const [revealed, setRevealed] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const privacyEnabled = privacyMode !== UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE;
  const visible = !privacyEnabled || (requirePasswordForPrivateContent ? privacySession.unlocked : revealed);

  useEffect(() => setRevealed(false), [privacyMode]);

  return (
    <>
      {visible ? (
        <>
          {privacyEnabled && (
            <div className="mb-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRevealed(false);
                  if (requirePasswordForPrivateContent) privacySession.lockAll();
                }}
              >
                <LockIcon className="size-3.5" />
                {t("setting.personal-features.hide-again")}
              </Button>
            </div>
          )}
          {children}
        </>
      ) : (
        <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (requirePasswordForPrivateContent) setUnlockOpen(true);
              else setRevealed(true);
            }}
          >
            {requirePasswordForPrivateContent ? <LockIcon className="size-4" /> : <EyeIcon className="size-4" />}
            {t("setting.personal-features.reveal-personal-panels")}
          </Button>
        </div>
      )}
      {unlockOpen && <PrivacyUnlockDialog open onOpenChange={setUnlockOpen} onUnlocked={privacySession.unlockAll} />}
    </>
  );
};

export default PersonalContent;
