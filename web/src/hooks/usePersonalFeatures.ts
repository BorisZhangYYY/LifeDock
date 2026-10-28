import { useAuth } from "@/contexts/AuthContext";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy } from "@/types/proto/api/v1/user_service_pb";

export const usePersonalFeatures = () => {
  const { currentUser, userGeneralSetting } = useAuth();
  const available = !!currentUser;
  const privacyMode = userGeneralSetting?.personalFeaturePrivacy ?? UserSetting_GeneralSetting_PersonalFeaturePrivacy.VISIBLE;

  return {
    remindersEnabled: available && !userGeneralSetting?.disableReminders,
    financeEnabled: available && !userGeneralSetting?.disableFinance,
    moodEnabled: available && !userGeneralSetting?.disableMood,
    privacyMode,
    requirePasswordForPrivateContent: userGeneralSetting?.requirePasswordForPrivateContent ?? false,
  };
};

export default usePersonalFeatures;
