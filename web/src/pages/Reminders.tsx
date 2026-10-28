import {
  AlarmClockIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  CircleIcon,
  FlagIcon,
  InboxIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useSearchParams } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import ReminderCompletionDialog from "@/components/Reminder/ReminderCompletionDialog";
import { ReminderDatePicker } from "@/components/Reminder/ReminderDateTimePicker";
import ReminderDetailDialog, { type ReminderDraft } from "@/components/Reminder/ReminderDetailDialog";
import ReminderListDialog, { type ReminderListDialogValue } from "@/components/Reminder/ReminderListDialog";
import ReminderListIcon, { isDefaultReminderList } from "@/components/Reminder/ReminderListIcon";
import ReminderMetadata from "@/components/Reminder/ReminderMetadata";
import ReminderStatistics from "@/components/Reminder/ReminderStatistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCurrentUser from "@/hooks/useCurrentUser";
import {
  useClearCompletedReminders,
  useCompleteReminder,
  useCreateReminder,
  useCreateReminderList,
  useDeleteReminder,
  useDeleteReminderList,
  useReminderLists,
  useReminders,
  useUpdateReminderList,
} from "@/hooks/useReminderQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import {
  ListRemindersRequest_View,
  type Reminder,
  Reminder_Priority,
  Reminder_Status,
  type ReminderList,
  ReminderRecurrence_Frequency,
} from "@/types/proto/api/v1/reminder_service_pb";
import { useTranslate } from "@/utils/i18n";
import { readRememberedReminderList, rememberReminderList, resolveReminderListSelection } from "@/utils/reminder-list-selection";
import { isReminderOverdue } from "@/utils/reminder-overdue";

type SmartView = "today" | "scheduled" | "all" | "flagged" | "statistics" | "settings" | "completed" | "archived";

const isSmartView = (value: string | null): value is SmartView =>
  value !== null && ["today", "scheduled", "all", "flagged", "statistics", "settings", "completed", "archived"].includes(value);

const VIEW_BY_ID: Record<SmartView, ListRemindersRequest_View> = {
  today: ListRemindersRequest_View.TODAY,
  scheduled: ListRemindersRequest_View.SCHEDULED,
  all: ListRemindersRequest_View.ALL,
  flagged: ListRemindersRequest_View.FLAGGED,
  statistics: ListRemindersRequest_View.ALL,
  settings: ListRemindersRequest_View.ALL,
  completed: ListRemindersRequest_View.COMPLETED,
  archived: ListRemindersRequest_View.ALL,
};

const listDisplayName = (list: { name: string; displayName: string }, translatedDefault: string) =>
  list.name.endsWith("/reminderLists/default") ? translatedDefault : list.displayName;

const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ReminderRow = ({
  reminder,
  list,
  archived,
  onComplete,
  onDelete,
  onChooseCompletionDate,
  onOpen,
  returnLocation,
}: {
  reminder: Reminder;
  list?: ReminderList;
  archived: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onChooseCompletionDate: () => void;
  onOpen: () => void;
  returnLocation: string;
}) => {
  const t = useTranslate();
  const completed = reminder.status === Reminder_Status.COMPLETED;
  const canChooseCompletionDate =
    !completed &&
    !archived &&
    isReminderOverdue(reminder) &&
    !!reminder.recurrence &&
    reminder.recurrence?.frequency !== ReminderRecurrence_Frequency.FREQUENCY_UNSPECIFIED;
  return (
    <div data-reminder-row className="group flex min-h-14 items-start gap-3 border-b border-border/70 px-1 py-3 last:border-b-0">
      <button
        type="button"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          completed
            ? "border-primary bg-primary text-primary-foreground"
            : archived
              ? "cursor-default border-muted-foreground/25"
              : "border-muted-foreground/40 hover:border-primary",
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (!completed && !archived) onComplete();
        }}
        aria-label={t("reminder.complete")}
      >
        {completed && <CheckIcon className="size-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" className="block w-full text-left" onClick={onOpen}>
          <span className={cn("block break-words text-sm leading-5", completed && "text-muted-foreground line-through")}>
            {reminder.title}
          </span>
        </button>
        <ReminderMetadata reminder={reminder} list={list} returnLocation={returnLocation} className="mt-1" />
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-1">
        {reminder.priority !== Reminder_Priority.PRIORITY_UNSPECIFIED ? (
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold leading-none text-primary">
            {"!".repeat(reminder.priority)}
          </span>
        ) : null}
        {reminder.flagged ? (
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-orange-400/10 text-orange-500">
            <FlagIcon className="size-3.5 fill-current" />
          </span>
        ) : null}
        {canChooseCompletionDate && (
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
            onClick={(event) => {
              event.stopPropagation();
              onChooseCompletionDate();
            }}
            aria-label={t("reminder.complete-on-date")}
            title={t("reminder.complete-on-date")}
          >
            <CalendarClockIcon className="size-4" />
          </button>
        )}
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label={t("common.delete")}
          title={t("common.delete")}
        >
          <Trash2Icon className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-primary opacity-60 transition-opacity hover:bg-primary/10 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          onClick={onOpen}
          aria-label={t("reminder.details")}
        >
          <InfoIcon className="size-5" />
        </button>
      </div>
    </div>
  );
};

interface Props {
  embedded?: boolean;
  onOpenReminder?: (reminderName: string) => void;
}

const Reminders = ({ embedded = false, onOpenReminder }: Props) => {
  const user = useCurrentUser();
  const t = useTranslate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const parent = user?.name;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const requestedView = searchParams.get("view");
  const requestedList = searchParams.get("list");
  const [activeView, setActiveView] = useState<SmartView>(isSmartView(requestedView) ? requestedView : "all");
  const [activeList, setActiveList] = useState(requestedList ?? "");
  const [query, setQuery] = useState("");
  const [draftVisible, setDraftVisible] = useState(false);
  const [draftListName, setDraftListName] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [draftFlagged, setDraftFlagged] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<ReminderList>();
  const [selectedReminder, setSelectedReminder] = useState<Reminder>();
  const selectedFromURL = searchParams.get("selected");
  const [deleteCandidate, setDeleteCandidate] = useState<Reminder>();
  const [clearCompletedOpen, setClearCompletedOpen] = useState(false);
  const [completionCandidate, setCompletionCandidate] = useState<Reminder>();
  const [deleteListCandidate, setDeleteListCandidate] = useState<ReminderList>();
  const [detailDraft, setDetailDraft] = useState<ReminderDraft>();
  const draftRef = useRef<HTMLInputElement>(null);
  const draftContainerRef = useRef<HTMLDivElement>(null);
  const draftCreateAreaRef = useRef<HTMLDivElement>(null);
  const draftCommitInProgressRef = useRef(false);
  const suppressBlankClickRef = useRef(false);
  const returnLocation = `${location.pathname}${location.search}${location.hash}`;

  const { data: lists = [] } = useReminderLists(parent);
  const { data: allReminders = [] } = useReminders(parent, { view: ListRemindersRequest_View.ALL, timeZone });
  const { data: completedForSelection = [] } = useReminders(parent, {
    view: ListRemindersRequest_View.COMPLETED,
    timeZone,
    enabled: Boolean(selectedFromURL),
  });
  const { data: archivedForSelection = [] } = useReminders(parent, {
    state: State.ARCHIVED,
    timeZone,
    enabled: Boolean(selectedFromURL) || activeView === "completed" || activeView === "archived",
  });
  useEffect(() => {
    if (!selectedFromURL) return;
    const selected = [...allReminders, ...completedForSelection, ...archivedForSelection].find(
      (item) => item.name === selectedFromURL || item.name.endsWith(`/${selectedFromURL}`),
    );
    if (selected) setSelectedReminder(selected);
  }, [selectedFromURL, allReminders, completedForSelection, archivedForSelection]);
  const recordsView = activeView !== "statistics" && activeView !== "settings";
  const selectedView = VIEW_BY_ID[activeView];
  const selectedState = activeView === "archived" ? State.ARCHIVED : State.NORMAL;
  const { data: reminders = [], isLoading } = useReminders(parent, {
    view: selectedView,
    state: selectedState,
    reminderList: activeList,
    query,
    timeZone,
    enabled: recordsView,
  });
  const createReminder = useCreateReminder();
  const completeReminder = useCompleteReminder();
  const clearCompleted = useClearCompletedReminders();
  const deleteReminder = useDeleteReminder();
  const deleteReminderList = useDeleteReminderList();
  const createList = useCreateReminderList();
  const updateList = useUpdateReminderList();

  const today = localDate();
  const counts = useMemo(() => {
    const scopedReminders = activeList ? allReminders.filter((reminder) => reminder.reminderList === activeList) : allReminders;
    return {
      today: scopedReminders.filter((reminder) => reminder.dueDate && reminder.dueDate <= today).length,
      scheduled: scopedReminders.filter((reminder) => !!reminder.dueDate || !!reminder.remindTime).length,
      all: scopedReminders.length,
      flagged: scopedReminders.filter((reminder) => reminder.flagged).length,
    };
  }, [activeList, allReminders, today]);

  useEffect(() => {
    if (!draftVisible) return;
    let focusConfirmationFrame = 0;
    const focusFrame = requestAnimationFrame(() => {
      draftRef.current?.focus({ preventScroll: true });
      focusConfirmationFrame = requestAnimationFrame(() => draftRef.current?.focus({ preventScroll: true }));
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      cancelAnimationFrame(focusConfirmationFrame);
    };
  }, [draftListName, draftVisible]);

  useEffect(() => {
    setActiveView(isSmartView(requestedView) ? requestedView : "all");
    setActiveList(requestedList ?? "");
    setDraftListName("");
    setDraftVisible(false);
  }, [requestedList, requestedView]);

  useEffect(() => {
    if (!activeList || lists.length === 0 || lists.some((list) => list.name === activeList)) return;
    setActiveList("");
    setSearchParams(
      (params) => {
        params.delete("list");
        return params;
      },
      { replace: true },
    );
  }, [activeList, lists, setSearchParams]);

  const selectView = (view: SmartView) => {
    setActiveView(view);
    const clearList = view === "all" || view === "statistics" || view === "settings";
    if (clearList) setActiveList("");
    setDraftListName("");
    setDraftVisible(false);
    setSearchParams((params) => {
      params.set("view", view);
      if (clearList) params.delete("list");
      else if (activeList) params.set("list", activeList);
      return params;
    });
  };

  const selectList = (name: string) => {
    const view = recordsView ? activeView : "all";
    setActiveList(name);
    setActiveView(view);
    setDraftListName("");
    setDraftVisible(false);
    if (parent) rememberReminderList(parent, name);
    setSearchParams((params) => {
      params.set("view", view);
      if (name) params.set("list", name);
      else params.delete("list");
      return params;
    });
  };

  const defaultList = activeList || resolveReminderListSelection(lists);
  const draftTargetList = draftListName || defaultList;
  const showDraftForList = (listName = defaultList) => {
    setDraftListName(listName);
    setDraftVisible(true);
  };
  const resetDraft = useCallback(() => {
    setDraftListName("");
    setDraftTitle("");
    setDraftDueDate("");
    setDraftFlagged(false);
    setDraftVisible(false);
  }, []);

  const commitDraft = useCallback(async () => {
    if (draftCommitInProgressRef.current) return;
    const title = draftTitle.trim();
    const reminderList = draftTargetList;
    const dueDate = draftDueDate || (activeView === "today" || activeView === "scheduled" ? today : "");
    const flagged = draftFlagged || activeView === "flagged";
    resetDraft();
    if (!title || !parent || !reminderList) {
      return;
    }
    draftCommitInProgressRef.current = true;
    try {
      await createReminder.mutateAsync({
        parent,
        reminder: { title, reminderList, dueDate, flagged, timeZone },
      });
    } finally {
      draftCommitInProgressRef.current = false;
    }
  }, [activeView, createReminder, draftDueDate, draftFlagged, draftTargetList, draftTitle, parent, resetDraft, timeZone, today]);

  useEffect(() => {
    if (!draftVisible) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (draftContainerRef.current?.contains(event.target as Node)) return;
      const target = event.target as HTMLElement;
      suppressBlankClickRef.current =
        !!draftCreateAreaRef.current?.contains(target) && !target.closest("button, input, [data-reminder-row], [data-reminder-draft], h2");
      void commitDraft();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [commitDraft, draftVisible]);

  const openDraftDetails = () => {
    setDetailDraft({
      title: draftTitle,
      reminderList: draftTargetList,
      dueDate: draftDueDate || (activeView === "today" || activeView === "scheduled" ? today : ""),
      flagged: draftFlagged || activeView === "flagged",
    });
    resetDraft();
  };

  const openListDialog = (list?: ReminderList) => {
    setEditingList(list);
    setListDialogOpen(true);
  };

  const saveList = async ({ displayName, color, icon }: ReminderListDialogValue) => {
    if (!parent) return;
    if (editingList) {
      const updateMask = ["color", "icon"];
      if (!isDefaultReminderList(editingList.name)) updateMask.unshift("display_name");
      await updateList.mutateAsync({
        reminderList: { name: editingList.name, displayName, color, icon },
        updateMask,
      });
      toast.success(t("reminder.list-saved"));
      return;
    }

    const list = await createList.mutateAsync({
      parent,
      reminderList: {
        displayName,
        color,
        icon,
        sortOrder: lists.length,
        state: State.NORMAL,
      },
    });
    if (activeView !== "settings") selectList(list.name);
    toast.success(t("reminder.list-saved"));
  };

  const smartViews: Array<{
    id: "today" | "scheduled" | "all" | "flagged";
    label: string;
    icon: typeof CalendarDaysIcon;
  }> = [
    { id: "today", label: t("common.today"), icon: CalendarDaysIcon },
    { id: "scheduled", label: t("reminder.scheduled"), icon: AlarmClockIcon },
    { id: "all", label: t("common.all"), icon: InboxIcon },
    { id: "flagged", label: t("reminder.flagged"), icon: FlagIcon },
  ];

  const grouped = useMemo(() => {
    if (activeList) return reminders.length > 0 ? [{ list: lists.find((item) => item.name === activeList), reminders }] : [];
    const map = new Map<string, Reminder[]>();
    for (const reminder of reminders) map.set(reminder.reminderList, [...(map.get(reminder.reminderList) ?? []), reminder]);
    // All keeps every list visible, including empty lists, with its own add target.
    const includeEmptyLists = activeView === "all" && !query.trim();
    const groups = lists
      .filter((list) => includeEmptyLists || map.has(list.name))
      .map((list) => ({ list, reminders: map.get(list.name) ?? [] }));
    const unknownGroups = Array.from(map.entries())
      .filter(([name]) => !lists.some((list) => list.name === name))
      .map(([, items]) => ({ list: undefined, reminders: items }));
    return [...groups, ...unknownGroups];
  }, [activeList, activeView, lists, query, reminders]);

  const draftGroupName = draftTargetList;
  const showPerListCreateTargets = !activeList && activeView === "all";
  const groupsWithDraft = useMemo(() => {
    if (!draftVisible || !draftGroupName || grouped.some((group) => group.list?.name === draftGroupName)) return grouped;
    const targetList = lists.find((list) => list.name === draftGroupName);
    if (!targetList) return grouped;

    const next = [...grouped];
    const targetOrder = lists.findIndex((list) => list.name === draftGroupName);
    const insertionIndex = next.findIndex((group) => {
      const groupOrder = lists.findIndex((list) => list.name === group.list?.name);
      return groupOrder >= 0 && groupOrder > targetOrder;
    });
    const draftGroup = { list: targetList, reminders: [] as Reminder[] };
    if (insertionIndex === -1) next.push(draftGroup);
    else next.splice(insertionIndex, 0, draftGroup);
    return next;
  }, [draftGroupName, draftVisible, grouped, lists]);

  const renderDraft = (bordered: boolean) => (
    <div ref={draftContainerRef} data-reminder-draft className={cn("scroll-mt-3 py-3", bordered && "border-t")}>
      <div className="flex items-start gap-3">
        <CircleIcon className="mt-1.5 size-5 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1">
          <Input
            ref={draftRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void commitDraft();
              if (event.key === "Escape") {
                event.stopPropagation();
                resetDraft();
              }
            }}
            className="h-8 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
            placeholder={t("reminder.new-reminder")}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ReminderDatePicker compact value={draftDueDate} onChange={setDraftDueDate} />
            <button
              type="button"
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground",
                draftFlagged && "bg-orange-400/15 text-orange-500",
              )}
              onClick={() => setDraftFlagged((value) => !value)}
              aria-label={t("reminder.flagged")}
            >
              <FlagIcon className={cn("size-3.5", draftFlagged && "fill-current")} />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openDraftDetails}
          aria-label={t("reminder.details")}
        >
          <InfoIcon className="size-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        embedded
          ? "m-3 h-[calc(100%-1.5rem)] min-h-0 w-[calc(100%-1.5rem)] rounded-xl border"
          : !recordsView
            ? "w-full"
            : "min-h-[calc(100dvh-6rem)] w-full",
      )}
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 space-y-4 pb-4">
          <div className="flex min-h-9 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{t("common.reminders")}</h1>
            </div>
          </div>
          <Tabs
            value={recordsView ? "records" : activeView}
            onValueChange={(value) => selectView(value === "records" ? "all" : (value as SmartView))}
          >
            <TabsList className="w-fit rounded-lg bg-muted/60 p-1">
              <TabsTrigger value="records" className="h-7 py-1 text-ui">
                {t("personal.records")}
              </TabsTrigger>
              <TabsTrigger value="statistics" className="h-7 py-1 text-ui">
                {t("common.statistics")}
              </TabsTrigger>
              <TabsTrigger value="settings" className="h-7 py-1 text-ui">
                {t("common.settings")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {recordsView && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-40 max-w-sm flex-1">
                  <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-8 pl-8 text-sm"
                    placeholder={t("reminder.search")}
                  />
                </div>
                {activeList && (
                  <div className="flex min-w-0 items-center gap-2 text-ui">
                    <Button size="sm" variant="ghost" className="text-ui" onClick={() => selectList("")}>
                      <ChevronLeftIcon className="size-3.5" />
                      {t("reminder.all-lists")}
                    </Button>
                    <span className="truncate text-muted-foreground">
                      {listDisplayName(
                        lists.find((list) => list.name === activeList) ?? { name: activeList, displayName: "" },
                        t("common.reminders"),
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {smartViews.map(({ id, label, icon: Icon }) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={activeView === id ? "secondary" : "ghost"}
                    onClick={() => selectView(id)}
                    aria-pressed={activeView === id}
                    className="h-7 py-1 text-ui"
                  >
                    <Icon className="size-3.5" />
                    {label}
                    <span className="text-xs tabular-nums text-muted-foreground">{counts[id]}</span>
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={activeView === "completed" ? "secondary" : "ghost"}
                  onClick={() => selectView("completed")}
                  aria-pressed={activeView === "completed"}
                  className="h-7 py-1 text-ui"
                >
                  <CheckIcon className="size-3.5" />
                  {t("reminder.completed")}
                </Button>
                {activeView !== "completed" && activeView !== "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 shrink-0 py-1 text-ui"
                    onClick={() => showDraftForList()}
                    aria-label={t("reminder.new-reminder")}
                  >
                    <PlusIcon className="size-3.5" />
                    {t("common.create")}
                  </Button>
                )}
                {activeView === "completed" && !activeList && reminders.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 shrink-0 py-1 text-ui"
                    disabled={clearCompleted.isPending}
                    onClick={() => setClearCompletedOpen(true)}
                  >
                    <Trash2Icon className="size-3.5" />
                    {t("reminder.clear-completed")}
                  </Button>
                )}
              </div>
            </>
          )}
        </header>

        <div
          ref={draftCreateAreaRef}
          className={cn("flex min-h-0 flex-1 flex-col rounded-xl border bg-card px-4 sm:px-5", recordsView && "cursor-text")}
          onClick={(event) => {
            if (suppressBlankClickRef.current) {
              suppressBlankClickRef.current = false;
              return;
            }
            const target = event.target as HTMLElement;
            if (target.closest("button, input, [data-reminder-row], [data-reminder-draft], h2")) return;
            if (showPerListCreateTargets) return;
            if (activeView !== "completed" && activeView !== "archived" && recordsView) {
              if (draftVisible) void commitDraft();
              else showDraftForList();
            }
          }}
        >
          {activeView === "statistics" ? (
            <ReminderStatistics parent={parent} />
          ) : activeView === "settings" ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{t("reminder.my-lists")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t("reminder.list-settings-description")}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-ui" onClick={() => openListDialog()}>
                  <PlusIcon className="size-3.5" />
                  {t("reminder.new-list")}
                </Button>
              </div>
              <div className="divide-y rounded-lg border">
                {lists.map((list) => {
                  const title = listDisplayName(list, t("common.reminders"));
                  return (
                    <div key={list.name} className="flex items-center gap-3 px-3 py-3">
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: list.color || "#0A84FF" }}
                      >
                        <ReminderListIcon icon={list.icon} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-ui"
                        onClick={() => openListDialog(list)}
                        aria-label={t("common.edit") + " " + title}
                      >
                        <PencilIcon className="size-3.5" />
                        {t("common.edit")}
                      </Button>
                      {!isDefaultReminderList(list.name) ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteListCandidate(list)}
                          aria-label={t("common.delete") + " " + title}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      ) : (
                        <span className="size-6 shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {isLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("reminder.loading")}</p>
              ) : grouped.length === 0 && !draftVisible ? (
                <button
                  type="button"
                  className="flex min-h-40 w-full flex-1 items-center justify-center text-sm text-muted-foreground"
                  onClick={() => activeView !== "completed" && activeView !== "archived" && !draftVisible && showDraftForList()}
                >
                  {activeView === "completed"
                    ? t("reminder.no-completed")
                    : activeView === "archived"
                      ? t("reminder.no-archived")
                      : t("reminder.click-empty-to-create")}
                </button>
              ) : (
                groupsWithDraft.map((group) => (
                  <section key={group.list?.name ?? "unknown"}>
                    {!activeList && group.list && (
                      <h2 className="border-b py-3 text-sm font-semibold" style={{ color: group.list.color || "#0A84FF" }}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          onClick={() => group.list && selectList(group.list.name)}
                          aria-label={listDisplayName(group.list, t("common.reminders")) + " " + group.reminders.length}
                        >
                          <ReminderListIcon icon={group.list.icon} className="size-4" />
                          <span className="min-w-0 flex-1 truncate">{listDisplayName(group.list, t("common.reminders"))}</span>
                          <span className="text-xs font-normal tabular-nums text-muted-foreground">{group.reminders.length}</span>
                        </button>
                      </h2>
                    )}
                    {group.reminders.map((reminder) => (
                      <ReminderRow
                        key={reminder.name}
                        reminder={reminder}
                        list={group.list}
                        archived={activeView === "archived"}
                        onComplete={() => completeReminder.mutate({ name: reminder.name })}
                        onDelete={() => setDeleteCandidate(reminder)}
                        onChooseCompletionDate={() => setCompletionCandidate(reminder)}
                        onOpen={() => (onOpenReminder ? onOpenReminder(reminder.name) : setSelectedReminder(reminder))}
                        returnLocation={returnLocation}
                      />
                    ))}
                    {draftVisible && group.list?.name === draftGroupName && renderDraft(group.reminders.length > 0)}
                    {showPerListCreateTargets && group.list && (!draftVisible || group.list.name !== draftGroupName) && (
                      <button
                        type="button"
                        data-reminder-list-create
                        className="flex min-h-14 w-full items-center gap-3 px-1 py-3 text-sm text-muted-foreground/60 transition-colors hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          showDraftForList(group.list?.name);
                        }}
                        aria-label={`${t("reminder.click-empty-to-create")}: ${listDisplayName(group.list, t("common.reminders"))}`}
                      >
                        <span className="size-5 rounded-full border-2 border-dotted border-current" />
                        <span>{t("reminder.new-reminder")}</span>
                      </button>
                    )}
                  </section>
                ))
              )}
              {grouped.length > 0 &&
                !draftVisible &&
                !showPerListCreateTargets &&
                activeView !== "completed" &&
                activeView !== "archived" && (
                  <button
                    type="button"
                    className="min-h-20 w-full flex-1 cursor-text"
                    onClick={(event) => {
                      event.stopPropagation();
                      showDraftForList();
                    }}
                    aria-label={t("reminder.click-empty-to-create")}
                  />
                )}
              {draftVisible && !groupsWithDraft.some((group) => group.list?.name === draftGroupName) && renderDraft(grouped.length > 0)}
            </div>
          )}
        </div>
      </section>

      {parent && (
        <ReminderDetailDialog
          reminder={selectedReminder}
          draft={detailDraft}
          lists={lists}
          parent={parent}
          open={!!selectedReminder || !!detailDraft}
          onOpenChange={(open) => {
            if (open) return;
            setSelectedReminder(undefined);
            setDetailDraft(undefined);
            if (selectedFromURL)
              setSearchParams(
                (next) => {
                  next.delete("selected");
                  return next;
                },
                { replace: true },
              );
          }}
        />
      )}
      <ReminderCompletionDialog
        reminder={completionCandidate}
        pending={completeReminder.isPending}
        onOpenChange={(open) => !open && setCompletionCandidate(undefined)}
        onConfirm={async (completionDate) => {
          if (!completionCandidate) return;
          await completeReminder.mutateAsync({ name: completionCandidate.name, completionDate });
        }}
      />
      <ReminderListDialog
        open={listDialogOpen}
        list={editingList}
        pending={createList.isPending || updateList.isPending}
        onOpenChange={(open) => {
          setListDialogOpen(open);
          if (!open) setEditingList(undefined);
        }}
        onSave={saveList}
      />
      <ConfirmDialog
        open={clearCompletedOpen}
        onOpenChange={setClearCompletedOpen}
        title={t("reminder.clear-completed")}
        description={t("reminder.clear-completed-description")}
        confirmLabel={t("common.clear")}
        cancelLabel={t("common.cancel")}
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!parent) return;
          const response = await clearCompleted.mutateAsync(parent);
          toast.success(t("reminder.cleared-count", { count: response.clearedCount }));
        }}
      />
      <ConfirmDialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(undefined)}
        title={t("reminder.delete-confirm")}
        description={t("reminder.delete-confirm-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!deleteCandidate) return;
          await deleteReminder.mutateAsync(deleteCandidate.name);
          toast.success(t("reminder.deleted"));
          setDeleteCandidate(undefined);
        }}
        confirmVariant="destructive"
      />
      <ConfirmDialog
        open={!!deleteListCandidate}
        onOpenChange={(open) => !open && setDeleteListCandidate(undefined)}
        title={t("reminder.delete-list-confirm")}
        description={t("reminder.delete-list-confirm-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          if (!deleteListCandidate) return;
          const defaultListName = resolveReminderListSelection(lists.filter((list) => list.name !== deleteListCandidate.name));
          await deleteReminderList.mutateAsync(deleteListCandidate.name);
          if (parent && readRememberedReminderList(parent) === deleteListCandidate.name) {
            rememberReminderList(parent, defaultListName);
          }
          if (activeList === deleteListCandidate.name) selectList("");
          toast.success(t("reminder.list-deleted"));
          setDeleteListCandidate(undefined);
        }}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default Reminders;
