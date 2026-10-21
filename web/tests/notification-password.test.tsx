import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotificationSection from "@/components/Settings/NotificationSection";
import { InstanceSetting_NotificationSettingSchema } from "@/types/proto/api/v1/instance_service_pb";

const save = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const notificationSetting = create(InstanceSetting_NotificationSettingSchema, {
  email: { smtpPassword: "saved-smtp-password", smtpHost: "smtp.example.com", smtpPort: 587, fromEmail: "sender@example.com" },
});
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ notificationSetting }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ email: "admin@example.com" }) }));
vi.mock("@/components/Settings/useInstanceSettingUpdater", () => ({
  default: () => save,
  buildInstanceSettingName: () => "instance/settings/NOTIFICATION",
}));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/connect", () => ({ instanceServiceClient: { testInstanceEmailSetting: vi.fn() } }));

describe("SMTP password", () => {
  it("masks the saved password, reveals it on request, and saves a replacement", () => {
    render(<NotificationSection />);
    const input = screen.getByLabelText("setting.notification.smtp-password");
    expect(input).toHaveValue("saved-smtp-password");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "setting.notification.show-password" }));
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "setting.notification.hide-password" }));
    expect(input).toHaveAttribute("type", "password");
    fireEvent.change(input, { target: { value: "replacement" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(save.mock.calls[0][0].setting.value.value.email.smtpPassword).toBe("replacement");
  });
});
