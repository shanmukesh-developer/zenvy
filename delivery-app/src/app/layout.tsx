import type { Metadata, Viewport } from "next";
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
  title: "Zenvy Rider | Logistics Command",
  description: "Elite Delivery Networking & Real-time Logistics Management",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0B"
};

import PushNotificationManager from '@/components/PushNotificationManager';
import AndroidBackButton from '@/components/AndroidBackButton';
import GlobalAnnouncement from '@/components/GlobalAnnouncement';
import { RiderToastProvider } from '@/components/RiderToast';

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
        <AndroidBackButton />
        <PushNotificationManager />
        <GlobalAnnouncement />
        <RiderToastProvider>
          {children}
        </RiderToastProvider>
      </body>
    </html>
  );
}
