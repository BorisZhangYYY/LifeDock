import { create } from "@bufbuild/protobuf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transcriptionService } from "@/components/MemoEditor/services/transcriptionService";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";

const transcribe = vi.hoisted(() => vi.fn());
vi.mock("@/connect", () => ({ aiServiceClient: { transcribe } }));
const attachment = (size = 8n) => create(AttachmentSchema, { name: "attachments/voice", filename: "voice.wav", type: "audio/wav", size });

afterEach(() => vi.unstubAllGlobals());

describe("existing audio attachment transcription", () => {
  it("downloads with the current session and forwards audio plus cancellation to the existing provider API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Length": "3" } }));
    vi.stubGlobal("fetch", fetchMock);
    transcribe.mockResolvedValue({ text: "Draft transcript" });
    const signal = new AbortController().signal;
    expect(await transcriptionService.transcribeAttachment(attachment(), signal)).toBe("Draft transcript");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("voice"), { signal, credentials: "same-origin" });
    expect(transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          source: { case: "content", value: new Uint8Array([1, 2, 3]) },
          filename: "voice.wav",
          contentType: "audio/wav",
        }),
      }),
      { signal },
    );
  });
  it("rejects oversized files before download or provider calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcriptionService.transcribeAttachment(attachment(26n * 1024n * 1024n))).rejects.toThrow("25 MiB");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
  });
  it("does not send failed downloads to the provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(transcriptionService.transcribeAttachment(attachment())).rejects.toThrow("403");
    expect(transcribe).not.toHaveBeenCalled();
  });
});
