import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Zenvy — Food Delivery",
  description: "Premium food delivery for your campus.",
};

import { CartProvider } from '@/context/CartContext';
import PushNotificationManager from '@/components/PushNotificationManager';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PushNotificationManager />
        <CartProvider>
          <div className="animate-page overflow-x-hidden w-full max-w-full relative">
            {children}
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
