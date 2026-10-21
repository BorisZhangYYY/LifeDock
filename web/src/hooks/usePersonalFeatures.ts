import { useAuth } from "@/contexts/AuthContext";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy } from "@/types/proto/api/v1/user_service_pb";

export const usePersonalFeatures = () => {
  const { userGeneralSetting } = useAuth();
  const privacyMode = userGeneralSetting?.personalFeaturePrivacy ?? UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE;

  return {
    remindersEnabled: !userGeneralSetting?.disableReminders,
    financeEnabled: !userGeneralSetting?.disableFinance,
    moodEnabled: !userGeneralSetting?.disableMood,
    privacyMode,
    requirePasswordForPrivateContent: userGeneralSetting?.requirePasswordForPrivateContent ?? false,
  };
};

export default usePersonalFeatures;
