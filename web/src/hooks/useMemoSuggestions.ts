import { useMemo } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoViews } from "@/hooks/useUserQueries";
import { getMemoSuggestions } from "@/lib/memo-suggestions";
import { BUILTIN_TASKS_VIEW_FILTER, BUILTIN_TASKS_VIEW_ID, getMemoViewId } from "@/lib/memo-views";

export function useMemoSuggestions(enabled = true) {
  const { filters, memoView } = useMemoFilterContext();
  const user = useCurrentUser();
  const { data: views = [] } = useMemoViews(enabled ? user?.name : undefined);
  const viewFilter =
    memoView === BUILTIN_TASKS_VIEW_ID ? BUILTIN_TASKS_VIEW_FILTER : views.find((view) => getMemoViewId(view.name) === memoView)?.filter;
  return useMemo(() => (enabled ? getMemoSuggestions(filters, viewFilter) : []), [enabled, filters, viewFilter]);
}
