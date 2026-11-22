import type { ReactNode } from "react";

/** The page's main landmark, target of the skip link; centred at up to 960 px (spec 10). */
export function Main({ children }: { children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[60rem] flex-1 px-4 py-6 focus:outline-none">
      {children}
    </main>
  );
}
