import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles.css";
import "../admin.css";

export const metadata: Metadata = {
  title: "TGF Vocational Pathways | Skills for what's next",
  description:
    "Explore TGF Vocational Pathways programmes, training locations and admissions information.",
  applicationName: "TGF Vocational Pathways",
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
