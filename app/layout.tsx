import type { Metadata } from "next";
import "./globals.css";
import { ConfigProvider } from "@/lib/context";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Postgres Chat Interface",
  description: "Chat with your PostgreSQL database using natural language",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#1e1e1c] text-white antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          <ConfigProvider>{children}</ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
