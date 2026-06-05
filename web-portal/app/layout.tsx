import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit, Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";
import Providers from "./providers";
import { LocalBusinessJsonLd } from "@/components/JsonLd";
import { HeaderV3 } from "@/components/v3/HeaderV3";
import { FooterV3 } from "@/components/v3/FooterV3";
import FeedbackButton from "@/components/FeedbackButton";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// Editorial display: Fraunces has an `opsz` axis (9–144) and an italic style,
// which is exactly what the v3 components target via `fontVariationSettings`.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Uniformes Escolares en Medellin | Catalogo Online por Colegio — Consuelo Rios",
    template: "%s | Uniformes Consuelo Rios",
  },
  description: "Compra uniformes escolares en Medellin. Catalogo por colegio con precios, tallas y pedidos online. Envio a domicilio o recoge en Boston, Medellin.",
  metadataBase: new URL('https://yourdomain.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Uniformes Escolares en Medellin | Consuelo Rios",
    description: "Compra uniformes escolares en Medellin. Catalogo por colegio con precios, tallas y pedidos online. Envio a domicilio.",
    url: 'https://yourdomain.com',
    siteName: 'Uniformes Consuelo Rios',
    images: [
      {
        url: '/logo.png',
        width: 1261,
        height: 908,
        alt: 'Uniformes Consuelo Rios - Uniformes Escolares en Medellin',
      },
    ],
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Uniformes Escolares en Medellin | Consuelo Rios",
    description: "Compra uniformes escolares en Medellin. Catalogo por colegio con precios, tallas y pedidos online.",
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#8B6914" />
      </head>
      <body
        className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased`}
      >
        <LocalBusinessJsonLd />
        <Providers>
          <HeaderV3 />
          <main>{children}</main>
          <ToastContainer />
          <FeedbackButton />
        </Providers>
        <Suspense fallback={<div className="bg-[#0F0E0C] h-64" />}>
          <FooterV3 />
        </Suspense>
      </body>
    </html>
  );
}
