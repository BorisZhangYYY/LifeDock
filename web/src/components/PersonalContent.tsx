import type { ReactNode } from "react";
import { usePrivacySession } from "@/contexts/PrivacySessionContext";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy } from "@/types/proto/api/v1/user_service_pb";

// Navigation verifies before entering the personal area. Keep its data unmounted
// until that verification has completed, without adding another reveal control.
const PersonalContent = ({ children }: { children: ReactNode }) => {
  const { privacyMode } = usePersonalFeatures();
  const { unlocked } = usePrivacySession();
  const hidden = privacyMode !== UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE && !unlocked;
  return hidden ? null : children;
};

export default PersonalContent;
