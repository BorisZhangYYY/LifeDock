import { create } from "@bufbuild/protobuf";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAttachmentTranscription } from "@/components/MemoEditor/hooks/useAttachmentTranscription";
import { validationService } from "@/components/MemoEditor/services/validationService";
import { createInitialState } from "@/components/MemoEditor/state";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

const transcribe = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/components/MemoEditor/services", () => ({ transcriptionService: { transcribeAttachment: transcribe } }));
vi.mock("react-hot-toast", () => ({ toast: notifications }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

describe("attachment transcription lifecycle", () => {
  it("deduplicates pending requests and suppresses text insertion after editor close", async () => {
    let resolve: (value: string) => void = () => {};
    transcribe.mockImplementation(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const onText = vi.fn();
    const attachment = create(AttachmentSchema, { name: "attachments/voice" });
    const { result, unmount } = renderHook(() => useAttachmentTranscription(onText));
    act(() => {
      void result.current.transcribeAttachment(attachment);
      void result.current.transcribeAttachment(attachment);
    });
    expect(transcribe).toHaveBeenCalledOnce();
    expect(result.current.transcribingAttachment).toBe(attachment.name);
    const signal = transcribe.mock.calls[0][1] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve("Late result"));
    expect(onText).not.toHaveBeenCalled();
  });
  it("adds only nonempty transcript text without mutating the original audio", async () => {
    const attachment = create(AttachmentSchema, { name: "attachments/voice", filename: "voice.wav" });
    const snapshot = { ...attachment };
    transcribe.mockResolvedValue("  Transcript  ");
    const onText = vi.fn();
    const { result } = renderHook(() => useAttachmentTranscription(onText));
    await act(async () => result.current.transcribeAttachment(attachment));
    expect(onText).toHaveBeenCalledWith("Transcript");
    expect(attachment).toEqual(snapshot);
    transcribe.mockResolvedValue("  ");
    await act(async () => result.current.transcribeAttachment(attachment));
    await waitFor(() => expect(result.current.transcribingAttachment).toBeUndefined());
    expect(onText).toHaveBeenCalledOnce();
    expect(notifications.error).toHaveBeenCalledWith("editor.audio-recorder.transcribe-empty");
  });
  it("blocks saving until transcription finishes", () => {
    const state = createInitialState();
    state.content = "Existing text";
    state.ui.isLoading.transcribing = true;
    expect(validationService.canSave(state)).toMatchObject({ valid: false, reason: "editor.validation.wait-for-transcription" });
  });
});
