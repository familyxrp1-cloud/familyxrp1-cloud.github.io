import type { Metadata } from "next";
import { Manrope, Baloo_2 } from "next/font/google";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const display = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "$FAMILY World — Private Concept",
  description:
    "A visual prototype of the $FAMILY XRPL community world. Front-end demo only, no wallet or backend connected.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased selection:bg-frost selection:text-ice-950">
        {children}
      </body>
    </html>
  );
}
