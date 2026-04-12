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
  title: "Zenvy Rider | Logistics Command",
  description: "Elite Delivery Networking & Real-time Logistics Management",
};

import PushNotificationManager from '@/components/PushNotificationManager';
import AndroidBackButton from '@/components/AndroidBackButton';
import GlobalAnnouncement from '@/components/GlobalAnnouncement';

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
        {children}
      </body>
    </html>
  );
}
