import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mi entrenamiento",
  description: "Tus rutinas, tu calendario y cada serie en un mismo lugar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Entrenar" },
  icons: { icon: "/pullup-192.png", apple: "/pullup-apple-touch.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}

