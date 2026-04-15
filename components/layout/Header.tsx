import Link from "next/link";
import Navigation from "./Navigation";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-surface-border">
      <div className="container-main flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-gold">МЕТАЛЛ</span>ПОРТАЛ
          </span>
        </Link>

        <Navigation />

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-foreground transition-colors"
          >
            Личный кабинет
          </Link>
          <Link
            href="/supplier"
            className="hidden sm:inline-flex btn-gold text-sm !py-2 !px-4"
          >
            Стать поставщиком
          </Link>
        </div>
      </div>
    </header>
  );
}
