import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { BrowserNoiseFilter } from "@/components/BrowserNoiseFilter";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "MediIQ — Smart Healthcare Platform",
  description: "Connect with qualified doctors. Book appointments. Manage your health.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-bg antialiased">
        <BrowserNoiseFilter />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: "10px", background: "#1e293b", color: "#fff", fontSize: "14px" },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
