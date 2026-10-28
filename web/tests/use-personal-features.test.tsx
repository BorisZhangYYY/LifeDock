import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { UserSetting_GeneralSetting_PersonalFeaturePrivacy as Privacy } from "@/types/proto/api/v1/user_service_pb";

const setting = vi.hoisted(() => ({ personalFeaturePrivacy: 0, requirePasswordForPrivateContent: false }));
const auth = vi.hoisted(() => ({
  currentUser: { name: "users/owner" } as { name: string } | undefined,
  userGeneralSetting: undefined as { disableMood?: boolean; disableFinance?: boolean; disableReminders?: boolean } | undefined,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ ...auth, userGeneralSetting: { ...setting, ...auth.userGeneralSetting } }) }));

beforeEach(() => {
  auth.currentUser = { name: "users/owner" };
  auth.userGeneralSetting = undefined;
});

describe("personal feature availability", () => {
  it("hides all personal features for anonymous visitors", () => {
    auth.currentUser = undefined;
    const { result } = renderHook(usePersonalFeatures);
    expect(result.current).toMatchObject({ moodEnabled: false, financeEnabled: false, remindersEnabled: false });
  });

  it("enables personal features once the user's identity is verified", () => {
    auth.currentUser = undefined;
    const { result, rerender } = renderHook(usePersonalFeatures);
    expect(result.current).toMatchObject({ moodEnabled: false, financeEnabled: false, remindersEnabled: false });
    auth.currentUser = { name: "users/owner" };
    rerender();
    expect(result.current).toMatchObject({ moodEnabled: true, financeEnabled: true, remindersEnabled: true });
  });

  it("honors the signed-in user's disabled features", () => {
    auth.userGeneralSetting = { disableMood: true, disableFinance: true, disableReminders: true };
    const { result } = renderHook(usePersonalFeatures);
    expect(result.current).toMatchObject({ moodEnabled: false, financeEnabled: false, remindersEnabled: false });
  });
});

describe("memo password independence from dashboard privacy", () => {
  it.each([
    [Privacy.VISIBLE, false, false],
    [Privacy.VISIBLE, true, true],
    [Privacy.BLURRED, false, false],
    [Privacy.COLLAPSED, false, false],
  ])("resolves privacy %s and the saved password choice %s to %s", (privacy, password, expected) => {
    setting.personalFeaturePrivacy = privacy;
    setting.requirePasswordForPrivateContent = password;
    const { result } = renderHook(usePersonalFeatures);
    expect(result.current.requirePasswordForPrivateContent).toBe(expected);
  });
});
