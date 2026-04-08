import "./globals.css";
import Navbar from "@/components/navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el">
      <body className="min-h-screen overflow-x-hidden">
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
          <img
            src="/background.jpg"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        <div
          className="fixed inset-0 pointer-events-none z-10 bg-white/20"
          aria-hidden="true"
        />

        <div className="relative z-20 min-h-screen">
          <Navbar />

          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}