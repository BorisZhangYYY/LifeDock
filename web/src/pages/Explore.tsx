import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import { useBrowseScope } from "@/hooks/useBrowseScope";
import { State } from "@/types/proto/api/v1/common_pb";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";

const Explore = () => {
  const { creatorName } = useBrowseScope();
  const { memoFilter: contextFilter, selectedSpaceName } = useSpaceContext();

  // Readable content and creator scoping match the other collection lenses.
  const memoFilter = useMemoFilters({
    includeMemoViews: true,
    includePinned: false,
    creatorName,
  });

  // Get sorting logic using unified hook (no pinned sorting)
  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: false,
    state: State.NORMAL,
  });

  return (
    <PagedMemoList
      renderer={(memo: Memo, { compact }) => (
        <MemoView key={getMemoKey(memo)} memo={memo} showCreator showVisibility showSpace={!selectedSpaceName} compact={compact} />
      )}
      listSort={listSort}
      orderBy={orderBy}
      filter={memoFilter}
      contextFilter={contextFilter}
      showCreator
    />
  );
};

export default Explore;
