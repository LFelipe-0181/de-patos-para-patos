import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: 'DuckZone',
  description: 'Mergulho Anônimo e Direct Exclusivo',
  robots: "noindex, nofollow", // ISSO BLOQUEIA O GOOGLE DE ACHAR O SITE
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#071115] text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}