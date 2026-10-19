import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { type Location, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext, useEditorSelector } from "../state";
import type { EditorToolbarProps } from "../types";
import AudienceMenu from "./AudienceMenu";
import InsertMenu from "./InsertMenu";
import MoodSelector from "./MoodSelector";
import ReminderSelector from "./ReminderSelector";

export const EditorToolbar: FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  memoName,
  space,
  canChooseSpace,
  onAudioRecorderClick,
  reminders = [],
  linkedReminderNames = [],
  onLinkedReminderNamesChange,
  viewToggles,
  onInsertImages,
}) => {
  const t = useTranslate();
  const { moodEnabled, remindersEnabled } = usePersonalFeatures();
  const { actions, dispatch } = useEditorContext();
  // Subscribe to narrow/derived slices so typing (which only changes content)
  // doesn't re-render the toolbar or the heavy InsertMenu it hosts. `valid`
  // flips only on empty↔non-empty / loading transitions, not per keystroke.
  const valid = useEditorSelector((s) => validationService.canSave(s).valid);
  const blockedReason = useEditorSelector((s) => validationService.canSave(s).reason);
  const blockedReasonDetail = useEditorSelector((s) => validationService.canSave(s).detail);
  const isSaving = useEditorSelector((s) => s.ui.isLoading.saving);
  const isUploading = useEditorSelector((s) => s.ui.isLoading.uploading);
  const location = useEditorSelector((s) => s.metadata.location);
  const visibility = useEditorSelector((s) => s.metadata.visibility);
  const moodLevel = useEditorSelector((s) => s.metadata.moodLevel ?? 0);
  const blockedMessage = valid
    ? undefined
    : blockedReason
      ? t(blockedReason, blockedReasonDetail ? { url: blockedReasonDetail } : undefined)
      : t("editor.validation.cannot-save");

  const handleLocationChange = (next?: Location) => {
    dispatch(actions.setMetadata({ location: next }));
  };

  const handleVisibilityChange = (next: Visibility) => {
    dispatch(actions.setMetadata({ visibility: next }));
  };
  const handleSpaceChange = (next: string) => {
    dispatch(actions.setMetadata({ space: next, ...(!next && visibility === Visibility.SPACE ? { visibility: Visibility.PRIVATE } : {}) }));
  };

  const handleMoodChange = (next: number) => {
    dispatch(actions.setMetadata({ moodLevel: next }));
  };

  return (
    <div className="w-full flex flex-row flex-wrap justify-between items-center gap-2 mb-2">
      <div className="min-w-0 flex flex-row flex-wrap justify-start items-center gap-1">
        <InsertMenu
          isUploading={isUploading}
          isSaving={isSaving}
          location={location}
          onLocationChange={handleLocationChange}
          memoName={memoName}
          onAudioRecorderClick={onAudioRecorderClick}
          viewToggles={viewToggles}
          onInsertImages={onInsertImages}
        />
        <AudienceMenu
          value={visibility}
          space={space}
          onChange={handleVisibilityChange}
          onSpaceChange={canChooseSpace ? handleSpaceChange : undefined}
          disabled={isSaving}
        />
        {moodEnabled && <MoodSelector moodLevel={moodLevel} onChange={handleMoodChange} />}
        {remindersEnabled && (
          <ReminderSelector
            reminders={reminders}
            linkedReminderNames={linkedReminderNames}
            onChange={onLinkedReminderNamesChange ?? (() => {})}
          />
        )}
      </div>

      <div className="ml-auto flex shrink-0 flex-row justify-end items-center gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
        )}

        {!valid && !isSaving && blockedMessage ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" tabIndex={0} aria-label={blockedMessage} />}>
              <Button onClick={onSave} disabled>
                {t("editor.save")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{blockedMessage}</TooltipContent>
          </Tooltip>
        ) : (
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? t("editor.saving") : t("editor.save")}
          </Button>
        )}
      </div>
    </div>
  );
};
