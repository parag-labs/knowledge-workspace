import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Workspace",
  description: "An evidence-grounded knowledge graph workspace: the LLM plans the query, deterministic code traverses the graph and cites its sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
