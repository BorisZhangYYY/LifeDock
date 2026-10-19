import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy as Privacy } from "@/types/proto/api/v1/user_service_pb";

const setting = vi.hoisted(() => ({ personalFeaturePrivacy: 0, requirePasswordForPrivateContent: false }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userGeneralSetting: setting }) }));

describe("personal privacy password policy", () => {
  it.each([
    [Privacy.VISIBLE, false, false],
    [Privacy.VISIBLE, true, true],
    [Privacy.BLURRED, false, true],
    [Privacy.COLLAPSED, false, true],
  ])("resolves privacy %s and the saved password choice %s to %s", (privacy, password, expected) => {
    setting.personalFeaturePrivacy = privacy;
    setting.requirePasswordForPrivateContent = password;
    const { result } = renderHook(usePersonalFeatures);
    expect(result.current.requirePasswordForPrivateContent).toBe(expected);
  });
});
