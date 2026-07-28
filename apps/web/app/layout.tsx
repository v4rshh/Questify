import type { Metadata } from "next";
export const metadata: Metadata = { title: "Questify", description: "Adaptive learning" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>{children}</body></html>;
}
