import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStatus } from "./admin";

/**
 * Whether the reader may organise, for showing them a way in.
 *
 * Asked of the server rather than inferred from being signed in, because the
 * answer is the config's `admins:` list and only the server has read it. Under
 * the same query key the navbar uses, so a page and the bar above it ask once
 * between them and never disagree.
 *
 * For offering something, never for protecting it. Every server function that
 * returns organiser data checks for itself.
 */
export function useIsAdmin() {
  const fetchAdminStatus = useServerFn(getAdminStatus);
  const { data } = useQuery({
    queryKey: ["adminStatus"],
    queryFn: () => fetchAdminStatus(),
  });

  return data?.isAdmin ?? false;
}
