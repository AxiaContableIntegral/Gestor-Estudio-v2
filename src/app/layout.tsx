import { cookies } from 'next/headers';
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "sonner";
import NextTopLoader from 'nextjs-toploader';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestor del Estudio | AXIA",
  description: "Plataforma interna del estudio contable AXIA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
  const user = cookieStore.get("axia_user")?.value;
  const role = cookieStore.get("axia_role")?.value;

  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-50 text-slate-900`} suppressHydrationWarning>
        <NextTopLoader color="#E47012" showSpinner={false} />
        <div className="flex min-h-screen">
          {user ? <Sidebar user={user} role={role} /> : null}
          <main className={`flex-1 overflow-y-auto bg-slate-50/50 ${user ? "p-8" : "p-0"}`}>
            {children}
          </main>
        </div>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
