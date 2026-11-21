import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/**
 * Async so the layout renders per request and reads the live APP_NAME, rather
 * than baking a build-time constant into the tab title.
 *
 * This deliberately does not fetch branding from the API: that would make
 * every page render depend on the backend being reachable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const appName =
    process.env.APP_NAME ?? process.env.NEXT_PUBLIC_APP_NAME ?? "FTTDDWA";

  return {
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description: "System administration console",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        {/*
          Publishes this container's configuration to the browser as
          window.__RUNTIME_CONFIG__, so one built image runs in any
          environment (see src/lib/runtime-config.ts).

          `beforeInteractive` is required and must stay: Next emits the tag
          into <head> ahead of the framework chunks, which is what guarantees
          the config exists before any app module runs. A bare <script src>
          would not do -- React 19 hoists those and may add `async`, losing
          the ordering guarantee.
        */}
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MotionConfig reducedMotion="user">
            {children}
            <Toaster richColors position="top-right" />
          </MotionConfig>
        </ThemeProvider>
      </body>
    </html>
  );
}
