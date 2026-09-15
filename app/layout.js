import { Geist, Geist_Mono } from "next/font/google";
import ScreenGuard from "./components/ScreenGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "GriffinScan",
  description: "Student attendance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ScreenGuard>{children}</ScreenGuard>
      </body>
    </html>
  );
}
