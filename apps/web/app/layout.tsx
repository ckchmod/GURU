import type { Metadata } from "next";
import "@react-sigma/core/lib/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GURU Guideline Graph Workbench",
  description: "API-backed graph-first workbench scaffold for public guideline corpus maintenance."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
