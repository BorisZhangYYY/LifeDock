import { useAuth } from "@/contexts/AuthContext";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy } from "@/types/proto/api/v1/user_service_pb";

export const usePersonalFeatures = () => {
  const { userGeneralSetting } = useAuth();
  const privacyMode = userGeneralSetting?.personalFeaturePrivacy ?? UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE;
  const privacyEnabled = privacyMode !== UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE;

  return {
    remindersEnabled: !userGeneralSetting?.disableReminders,
    financeEnabled: !userGeneralSetting?.disableFinance,
    moodEnabled: !userGeneralSetting?.disableMood,
    privacyMode,
    // Hidden personal content requires verification even with an older saved password toggle set to false.
    requirePasswordForPrivateContent: privacyEnabled || (userGeneralSetting?.requirePasswordForPrivateContent ?? false),
  };
};

export default usePersonalFeatures;
