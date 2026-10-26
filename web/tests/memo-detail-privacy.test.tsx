import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoViewContext } from "@/components/MemoView/MemoViewContext";
import { PrivacySessionProvider } from "@/contexts/PrivacySessionContext";
import MemoDetail from "@/pages/MemoDetail";
import { MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

const mocks = vi.hoisted(() => ({ password: false, setMemoDetail: vi.fn(), verify: vi.fn() }));
const makeMemo = (name: string) =>
  create(MemoSchema, {
    name,
    creator: "users/test",
    content: "# Secret heading\n\n## Private details",
    tags: ["sensitive"],
    parent: "memos/parent",
  });
const parent = create(MemoSchema, { name: "memos/parent", content: "Secret parent text", tags: ["sensitive"] });
vi.mock("@/connect", () => ({ authServiceClient: { verifyPassword: mocks.verify } }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/test" }) }));
vi.mock("@/hooks/useMemoDetailError", () => ({ default: () => undefined }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { name: "users/test" },
    isInitialized: true,
    userGeneralSetting: { requirePasswordForPrivateContent: mocks.password, disableReminders: true },
    userTagsSetting: { tags: { sensitive: { blurContent: true } } },
  }),
}));
vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ isInitialized: true, memoRelatedSetting: {} }) }));
vi.mock("@/contexts/AppSidebarContext", () => ({ useAppSidebar: () => ({ setMemoDetail: mocks.setMemoDetail }) }));
vi.mock("@/hooks/useMemoQueries", () => ({
  useMemo: (name: string) => ({ data: name === parent.name ? parent : makeMemo(name), isLoading: false }),
  useInfiniteMemoComments: () => ({ data: [] }),
}));
vi.mock("@/hooks/useMemoShareQueries", () => ({
  useSharedMemo: () => ({}),
  withShareAttachmentLinks: (attachments: unknown) => attachments,
}));
vi.mock("@/hooks/useReminderQueries", () => ({ useReminders: () => ({ data: [] }), useReminderLists: () => ({ data: [] }) }));
vi.mock("@/components/MemoCommentSection", () => ({ default: () => null }));
vi.mock("@/components/Reminder/ReminderDetailDialog", () => ({ default: () => null }));
vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ children }: { children: React.ReactNode }) => children,
  useResolvedUser: () => undefined,
}));
vi.mock("@/components/MemoEditor/Toolbar/MoodSelector", () => ({ DEFAULT_MOOD_EMOJIS: [] }));
vi.mock("@/components/MemoView/hooks", () => ({
  useImagePreview: () => ({ previewState: { items: [], open: false, index: 0 } }),
}));
vi.mock("@/components/MemoView/components", () => ({
  MemoHeader: () => null,
  MemoCommentListView: () => null,
  MemoBody: () => {
    const { showBlurredContent, toggleBlurVisibility } = useMemoViewContext();
    return (
      <button type="button" onClick={toggleBlurVisibility}>
        {showBlurredContent ? "Revealed" : "Hidden"}
      </button>
    );
  },
}));

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/memos/private"]}>
      <PrivacySessionProvider>
        <Link to="/memos/other">Other memo</Link>
        <Link to="/memos/private">First memo</Link>
        <Routes>
          <Route path="/memos/:uid" element={<MemoDetail />} />
        </Routes>
      </PrivacySessionProvider>
    </MemoryRouter>,
  );
const expectHidden = (contentHidden: boolean) =>
  expect(mocks.setMemoDetail).toHaveBeenLastCalledWith(expect.objectContaining({ contentHidden }));

beforeEach(() => {
  mocks.password = false;
  mocks.setMemoDetail.mockReset();
  mocks.verify.mockResolvedValue({});
});

describe("memo detail privacy", () => {
  it("keeps sidebar visibility in sync with click-to-reveal and resets when navigating", () => {
    renderDetail();
    expectHidden(true);
    expect(screen.queryByText("Secret parent text")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.memo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    expectHidden(false);
    fireEvent.click(screen.getByRole("button", { name: "Revealed" }));
    expectHidden(true);
    fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    fireEvent.click(screen.getByRole("link", { name: "Other memo" }));
    expectHidden(true);
    fireEvent.click(screen.getByRole("link", { name: "First memo" }));
    expectHidden(true);
  });

  it("reveals the sidebar only after password verification and hides it again when locked", async () => {
    mocks.password = true;
    renderDetail();
    expectHidden(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expectHidden(true);
    fireEvent.click(screen.getByRole("button", { name: "Hidden" }));
    fireEvent.change(screen.getByLabelText("common.password"), { target: { value: "account password" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.personal-features.unlock" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Revealed" })).toBeInTheDocument());
    expectHidden(false);
    fireEvent.click(screen.getByRole("button", { name: "Revealed" }));
    expectHidden(true);
  });
});
