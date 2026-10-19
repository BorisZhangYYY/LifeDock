import useCurrentUser from "@/hooks/useCurrentUser";
import { useSpaces } from "@/hooks/useSpaceQueries";
import type { VisibilitySelectorProps } from "../types";
import VisibilitySelector from "./VisibilitySelector";

export default function AudienceMenu(props: VisibilitySelectorProps) {
  const user = useCurrentUser();
  const { data: spaces, isLoading, isError, refetch } = useSpaces(user?.name, { enabled: Boolean(props.onSpaceChange) });
  return (
    <VisibilitySelector {...props} spaces={spaces} spacesLoading={isLoading} spacesError={isError} onRetrySpaces={() => void refetch()} />
  );
}
