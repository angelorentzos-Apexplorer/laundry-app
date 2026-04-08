import Link from "next/link";
import Image from "next/image";

const linkClass =
  "rounded-xl px-4 py-3 text-base md:text-lg font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-black";

export default function Navbar() {
  return (
    <header className="border-b bg-white/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={240}
            height={90}
            priority
            className="h-16 w-auto object-contain md:h-20"
          />
        </Link>

        <nav className="flex items-center gap-2 md:gap-3">
          <Link href="/" className={linkClass}>
            Dashboard
          </Link>
          <Link href="/orders" className={linkClass}>
            Παραγγελίες
          </Link>
          <Link href="/customers" className={linkClass}>
            Πελάτες
          </Link>
          <Link href="/products" className={linkClass}>
            Προϊόντα
          </Link>
        </nav>
      </div>
    </header>
  );
}