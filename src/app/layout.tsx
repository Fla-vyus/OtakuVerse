import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OtakuVerse — Mangás, Manhwas, LNs e Animes com curadoria de IA",
  description:
    "Portal brasileiro para garimpar mangás, manhwas, manhuas, light novels e animes: tags detalhadas, idiomas, capítulos, estimativa de próximos lançamentos, obras parecidas, links oficiais e uma curadora de IA pronta pra te achar a próxima obsessão.",
  keywords: ["mangá", "manhwa", "light novel", "anime", "ecchi", "webtoon", "recomendações", "IA"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "OtakuVerse",
    description: "Seu garimpo de mangás, manhwas, LNs e animes com curadoria de IA.",
    siteName: "OtakuVerse",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
