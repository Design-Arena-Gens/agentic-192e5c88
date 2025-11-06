import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Transcription Agent",
  description: "Extract slides and transcribe audio from videos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
