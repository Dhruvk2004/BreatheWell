"use client";

import { useRouter } from "next/navigation";

/** After leaving a family, deleting it or signing out: go there and drop every cached page. */
export function useGoTo(): (path: string) => void {
  const router = useRouter();
  return (path) => {
    router.replace(path);
    router.refresh();
  };
}
