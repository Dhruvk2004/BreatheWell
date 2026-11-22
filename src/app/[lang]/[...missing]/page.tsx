import { notFound } from "next/navigation";

/** Any path no route matches: the 404 in the page language (`../not-found.tsx`). */
export default function MissingPage() {
  notFound();
}
