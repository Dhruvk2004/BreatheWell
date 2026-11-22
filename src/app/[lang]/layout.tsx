import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Noto_Sans_Devanagari } from "next/font/google";
import { TEXT_SIZE_SCRIPT } from "@/components/prefs/cookies";
import { Main } from "@/components/shell/Main";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SkipLink } from "@/components/shell/SkipLink";
import { siteMetadata } from "@/i18n/metadata";
import { currentLang } from "@/i18n/server";
import { LANGS } from "@/i18n/t";
import "../globals.css";

// Design fonts: Atkinson Hyperlegible Next 400/700 (Latin, preloaded) and Noto Sans Devanagari
// 400/600 (not preloaded: it downloads only when Hindi text is on screen).
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-noto-deva",
  display: "swap",
  preload: false,
});

// Every page is prerendered once per language; src/proxy.ts picks the variant from the cookie.
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

export const generateMetadata = async (): Promise<Metadata> => siteMetadata(await currentLang());

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B5E7A" },
    { media: "(prefers-color-scheme: dark)", color: "#0E171C" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await currentLang();
  // data-text is set before paint by the inline script (saved text size), hence suppressHydrationWarning.
  return (
    <html lang={lang} data-text="md" className={`${atkinson.variable} ${notoDeva.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <SkipLink lang={lang} />
        <SiteHeader lang={lang} />
        <Main>{children}</Main>
        <SiteFooter lang={lang} />
      </body>
    </html>
  );
}
