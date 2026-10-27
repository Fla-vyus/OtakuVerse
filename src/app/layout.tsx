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
  title: "OtakuVerse — Mangás, Manhwas, LNs, Animes e Dramas com curadoria de IA",
  description:
    "Portal brasileiro para garimpar mangás, manhwas, manhuas, light novels, animes e dramas: catálogo real com milhares de obras, hype do momento, calendário de lançamentos, notícias, revistas de publicação, nuvem pessoal, temas e a waifu curadora Aoi.",
  keywords: ["mangá", "manhwa", "manhua", "light novel", "anime", "drama", "ecchi", "webtoon", "recomendações", "IA", "waifu"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "OtakuVerse",
    description: "Seu garimpo de mangás, manhwas, LNs, animes e dramas com a waifu curadora Aoi.",
    siteName: "OtakuVerse",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

/** Aplica tema salvo antes da hidratação (anti-flash) */
const THEME_INIT = `try{var t=localStorage.getItem('ov_theme');if(t)document.documentElement.setAttribute('data-ov-theme',t);}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-ov-theme="azul" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
