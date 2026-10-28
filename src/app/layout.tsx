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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "OtakuVerse — Mangás, Manhwas, Webnovels, LNs e Animes com curadoria de IA",
  description:
    "Portal brasileiro para garimpar mangás, manhwas, manhuas, light novels, webnovels e animes: catálogo real com dezenas de milhares de obras, hype do momento, vendas (Oricon), revistas, calendário de capítulos, notícias, nuvem pessoal, temas e a waifu curadora Aoi. Instale como app!",
  keywords: ["mangá", "manhwa", "manhua", "light novel", "webnovel", "web novel", "anime", "ecchi", "webtoon", "vendas", "oricon", "revistas", "recomendações", "IA", "waifu", "pwa"],
  applicationName: "OtakuVerse",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "OtakuVerse",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "OtakuVerse",
    description: "Seu garimpo de mangás, manhwas, webnovels, LNs e animes com a waifu curadora Aoi.",
    siteName: "OtakuVerse",
    type: "website",
    locale: "pt_BR",
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
