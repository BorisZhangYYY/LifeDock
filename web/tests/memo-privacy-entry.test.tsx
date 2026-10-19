import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoView from "@/components/MemoView/MemoView";
import { useMemoViewContext } from "@/components/MemoView/MemoViewContext";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), loadEditor: vi.fn() }));
vi.mock("@/connect", () => ({ authServiceClient: { verifyPassword: mocks.verify } }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test", role: 1 }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    userGeneralSetting: { personalFeaturePrivacy: 1, requirePasswordForPrivateContent: false },
    userTagsSetting: undefined,
  }),
}));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ memoRelatedSetting: {} }) }));
vi.mock("@/contexts/PrivacySessionContext", () => ({
  usePrivacySession: () => {
    const [unlocked, setUnlocked] = useState(false);
    return {
      isReminderLinkedMemo: () => true,
      isMemoUnlocked: () => unlocked,
      unlockMemo: () => setUnlocked(true),
      lockMemo: () => setUnlocked(false),
    };
  },
}));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({ useResolvedUser: () => undefined }));
vi.mock("@/components/MemoEditor/Toolbar/MoodSelector", () => ({ DEFAULT_MOOD_EMOJIS: [] }));
vi.mock("@/components/MemoEditor/loader", () => ({ loadMemoEditor: mocks.loadEditor }));
vi.mock("@/components/MemoView/hooks", () => ({
  useImagePreview: () => ({ previewState: { items: [], open: false, index: 0 }, openPreview: vi.fn(), setPreviewOpen: vi.fn() }),
}));
vi.mock("@/components/MemoView/components", () => ({
  MemoHeader: ({ onReminderSelect }: { onReminderSelect?: (name: string) => void }) => {
    const { openEditor } = useMemoViewContext();
    return (
      <>
        <button type="button" onClick={openEditor}>
          Edit memo
        </button>
        <button type="button" onClick={() => onReminderSelect?.("reminders/private")}>
          Open linked reminder
        </button>
      </>
    );
  },
  MemoBody: () => {
    const { showBlurredContent, toggleBlurVisibility } = useMemoViewContext();
    return (
      <>
        <span>{showBlurredContent ? "Revealed" : "Hidden"}</span>
        <button type="button" onClick={toggleBlurVisibility}>
          Toggle sensitive content
        </button>
      </>
    );
  },
  MemoCommentListView: () => null,
}));

const renderMemo = (path = "/", onReminderSelect?: (name: string) => void) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MemoView
        memo={create(MemoSchema, { name: "memos/private", creator: "users/test", content: "Sensitive text" })}
        onReminderSelect={onReminderSelect}
      />
    </MemoryRouter>,
  );
const verify = async () => {
  fireEvent.change(screen.getByLabelText("common.password"), { target: { value: "account password" } });
  fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.unlock" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
};

beforeEach(() => {
  mocks.verify.mockReset();
  mocks.verify.mockResolvedValue({});
  mocks.loadEditor.mockReset();
  mocks.loadEditor.mockResolvedValue({ default: () => <div>Memo editor</div> });
});

describe("sensitive memo entry", () => {
  it("prompts automatically in detail and keeps cancellation locked", () => {
    renderMemo("/memos/private");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not interrupt a feed until sensitive content is requested", async () => {
    renderMemo();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle sensitive content" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await verify();
    expect(screen.getByText("Revealed")).toBeInTheDocument();
  });

  it("requires verification before opening the sensitive memo editor", async () => {
    renderMemo();
    fireEvent.click(screen.getByRole("button", { name: "Edit memo" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.loadEditor).not.toHaveBeenCalled();
    await verify();
    expect(await screen.findByText("Memo editor")).toBeInTheDocument();
    expect(mocks.loadEditor).toHaveBeenCalledOnce();
  });

  it("requires verification before opening a reminder linked to a hidden memo", async () => {
    const onReminderSelect = vi.fn();
    renderMemo("/", onReminderSelect);
    fireEvent.click(screen.getByRole("button", { name: "Open linked reminder" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onReminderSelect).not.toHaveBeenCalled();
    await verify();
    expect(onReminderSelect).toHaveBeenCalledWith("reminders/private");
  });
});
