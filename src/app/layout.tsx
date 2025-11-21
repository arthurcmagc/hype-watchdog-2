import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hype WatchDog 2.0",
  description: "Dashboard de monitoramento UniFi / N-central",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="flex flex-col min-h-screen">
          {/* Topbar */}
          <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-500" />
                <div>
                  <p className="text-sm font-semibold tracking-wide">
                    Hype WatchDog 2.0
                  </p>
                  <p className="text-xs text-slate-400">
                    UniFi / N-central • Dashboard de Hosts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <nav className="flex items-center gap-2 text-xs">
                  <Link
                    href="/"
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-medium text-slate-200 hover:border-indigo-500 hover:text-indigo-200"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/events"
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-medium text-slate-200 hover:border-indigo-500 hover:text-indigo-200"
                  >
                    Events & Alerts
                  </Link>
                  <Link
                    href="/?tv=1"
                    className="rounded-full border border-indigo-500/60 bg-indigo-500/10 px-3 py-1 font-semibold text-indigo-100 hover:bg-indigo-500/20"
                  >
                    TV Mode
                  </Link>
                </nav>
                <span className="hidden rounded-full bg-slate-800 px-3 py-1 text-[11px] text-slate-300 md:inline">
                  LAB • Next.js + Prisma
                </span>
              </div>
            </div>
          </header>

          {/* Conteúdo */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}