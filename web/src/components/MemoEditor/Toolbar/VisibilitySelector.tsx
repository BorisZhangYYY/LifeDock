import { CheckIcon, ChevronDownIcon, PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import SpaceMark from "@/components/SpaceMark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import VisibilityIcon from "@/components/VisibilityIcon";
import { useInstance } from "@/contexts/InstanceContext";
import { extractSpaceUidFromName, getDuplicateSpaceTitles } from "@/lib/space-display";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { getAssignableVisibilityOptions, getVisibilityOption } from "@/utils/memo";
import { isMemoVisibilityEnabled } from "@/utils/visibility";
import type { VisibilitySelectorProps } from "../types";

const VisibilitySelector = (props: VisibilitySelectorProps) => {
  const { value, onChange } = props;
  const compact = props.size === "compact";
  const t = useTranslate();
  const { memoRelatedSetting } = useInstance();
  const allowedVis = memoRelatedSetting.allowedVisibilities || [];

  const visibilityOptions = getAssignableVisibilityOptions({ hasSpacePlacement: Boolean(props.space), current: value }).filter((option) =>
    isMemoVisibilityEnabled(option.name, allowedVis),
  );
  // Resolved from the full catalog, so the trigger names the memo's audience even
  // when that audience is not currently on offer.
  const currentOption = getVisibilityOption(value);
  const currentVisibilityAllowed = isMemoVisibilityEnabled(currentOption?.name ?? "PRIVATE", allowedVis);
  const spaces = props.spaces ?? [];
  const duplicates = getDuplicateSpaceTitles(spaces);
  const spaceLabel = (space: (typeof spaces)[number]) =>
    duplicates.has(space.title) ? `${space.title} (${extractSpaceUidFromName(space.name)})` : space.title;
  const selectedSpace = spaces.find((space) => space.name === props.space);
  const destination = selectedSpace ? spaceLabel(selectedSpace) : props.space ? extractSpaceUidFromName(props.space) : "";

  return (
    <DropdownMenu onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={props.disabled}
            className={cn(
              "inline-flex items-center rounded-md hover:bg-accent transition-colors",
              compact ? "px-1.5 py-[3px] text-[13px] leading-5 text-foreground/85" : "h-8 px-2 text-sm text-muted-foreground",
              !currentVisibilityAllowed && "text-amber-700 dark:text-amber-300",
            )}
            title={
              !currentVisibilityAllowed && currentOption
                ? t("memo.visibility.disabled-current-title", { visibility: t(currentOption.labelKey) })
                : undefined
            }
          />
        }
      >
        {props.onSpaceChange && props.space && (
          <span className="mr-1.5 max-w-28 truncate" title={destination}>
            {destination} ·
          </span>
        )}
        <VisibilityIcon visibility={value} className={cn("opacity-60 mr-1.5", compact && "w-[13px]")} />
        <span className="truncate">{currentOption ? t(currentOption.labelKey) : ""}</span>
        <ChevronDownIcon className={cn("ml-0.5 opacity-60", compact ? "size-3.5 text-muted-foreground/70" : "w-4 h-4")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        {!currentVisibilityAllowed && currentOption && (
          <>
            <div role="note" className="mx-1 mb-1 max-w-72 rounded-md bg-amber-500/10 px-2.5 py-2 text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                <span>{t("memo.visibility.disabled-current-title", { visibility: t(currentOption.labelKey) })}</span>
              </div>
              <p className="mt-1 text-xs leading-4 text-amber-800/80 dark:text-amber-200/80">
                {t("memo.visibility.disabled-current-description", { visibility: t(currentOption.labelKey) })}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <VisibilityIcon visibility={currentOption.value} />
              <div className="flex flex-col">
                <span>{t(currentOption.labelKey)}</span>
                <span className="text-xs text-muted-foreground">{t("memo.visibility.disabled-by-policy")}</span>
              </div>
              <CheckIcon className="ml-auto w-4 h-4 text-amber-600" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {visibilityOptions.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <VisibilityIcon visibility={option.value} />
            <div className="flex flex-col">
              <span>{t(option.labelKey)}</span>
              <span className="text-xs text-muted-foreground">{t(option.descriptionKey)}</span>
            </div>
            {value === option.value && <CheckIcon className="ml-auto w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {props.onSpaceChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {props.space ? <SpaceMark icon={selectedSpace?.icon} size="sm" /> : <PlusIcon className="size-4" />}
                <span className="min-w-0 flex-1 truncate">{destination || t("space.add-to")}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 w-60 overflow-y-auto">
                {props.space && (
                  <DropdownMenuItem onClick={() => props.onSpaceChange?.("")}>
                    <XIcon className="size-4" />
                    {t("space.remove-from", { space: destination })}
                  </DropdownMenuItem>
                )}
                {spaces.map((space) => (
                  <DropdownMenuItem key={space.name} onClick={() => props.onSpaceChange?.(space.name)}>
                    <SpaceMark icon={space.icon} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{spaceLabel(space)}</span>
                    {space.name === props.space && <CheckIcon className="size-4" />}
                  </DropdownMenuItem>
                ))}
                {props.spacesLoading && <DropdownMenuItem disabled>{t("space.loading")}</DropdownMenuItem>}
                {props.spacesError && (
                  <DropdownMenuItem closeOnClick={false} onClick={props.onRetrySpaces}>
                    {t("space.load-error")} · {t("search.retry")}
                  </DropdownMenuItem>
                )}
                {!props.spacesLoading && !props.spacesError && !spaces.length && (
                  <DropdownMenuItem disabled>{t("space.no-spaces")}</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VisibilitySelector;
