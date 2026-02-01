import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Uniformes Consuelo Rios - Portal de Clientes",
  description: "Catalogo de uniformes escolares y pedidos online. Calidad y los mejores precios en uniformes escolares.",
  metadataBase: new URL('https://yourdomain.com'),
  openGraph: {
    title: "Uniformes Consuelo Rios",
    description: "Catalogo de uniformes escolares y pedidos online. Calidad y los mejores precios.",
    url: 'https://yourdomain.com',
    siteName: 'Uniformes Consuelo Rios',
    images: [
      {
        url: '/logo.png',
        width: 1261,
        height: 908,
        alt: 'Uniformes Consuelo Rios - Uniformes Escolares de Calidad',
      },
    ],
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Uniformes Consuelo Rios",
    description: "Catalogo de uniformes escolares y pedidos online. Calidad y los mejores precios.",
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
      <body
        className={`${outfit.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
