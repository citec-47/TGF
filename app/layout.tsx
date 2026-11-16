import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles.css";
import "../corporate.css";
import "../admin.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.transgenerationalforces.com"),
  title: "Transgenerational Forces Group | Base For Better Living",
  description:
    "Transgenerational Forces Group creates solutions that improve everyday life and build a lasting impact across generations.",
  applicationName: "Transgenerational Forces Group",
  referrer: "strict-origin-when-cross-origin",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
