import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import CartButton from "./CartButton";
import SearchBar from "./SearchBar";
import Image from "next/image";

/** Navigation structure — edit this array to change the menu. */
const navMenu = [
  {
    label: "Invitations",
    href: "/collections/wedding",
    dropdown: [
      { section: "By Occasion" },
      { label: "Wedding", href: "/collections/wedding" },
      { label: "Housewarming", href: "/collections/housewarming" },
      { label: "Thread Ceremony", href: "/collections/thread-ceremony" },
      { label: "Naming Ceremony", href: "/collections/naming-ceremony" },
      { label: "Birthday", href: "/collections/birthday" },
      { label: "Baby Shower", href: "/collections/baby-shower" },
    ],
  },
  {
    label: "Luxe",
    href: "/collections/luxe",
    dropdown: [
      { label: "Luxe Invitations", href: "/collections/luxe" },
      { label: "Luxe Boxes", href: "/collections/luxe" },
    ],
  },
  { label: "Gifts", href: "/collections/wedding" },
  { label: "Stores", href: "/" },
  {
    label: "Explore",
    href: "/",
    dropdown: [
      { label: "Happy Customers", href: "/" },
      { label: "Become a Dealer", href: "/" },
      { label: "About Us", href: "/" },
    ],
  },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gold/25 bg-ivory shadow-[0_2px_20px_rgba(123,28,46,0.08)]">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6">
        <Image src="/logo.png" alt="Beyond Invitation" width={40} height={40} />
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-[22px] font-bold tracking-wide text-maroon">
            Beyond Invitation
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-gold">
            Wedding Invitation Specialists
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navMenu.map((item) => (
            <div key={item.label} className="group relative">
              <Link
                href={item.href}
                className="block whitespace-nowrap rounded-md px-3.5 py-2 text-[13.5px] font-medium text-ink transition hover:bg-gold-pale hover:text-maroon"
              >
                {item.label}
                {item.dropdown && " ▾"}
              </Link>

              {item.dropdown && (
                <div className="absolute left-0 top-full hidden min-w-[220px] animate-fadeDown rounded-xl border border-gold/25 bg-white p-2 shadow-[0_8px_40px_rgba(123,28,46,0.12)] group-hover:block">
                  {item.dropdown.map((d, i) =>
                    "section" in d ? (
                      <div
                        key={`sec-${i}`}
                        className="mt-1.5 px-3.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gold"
                      >
                        {d.section}
                      </div>
                    ) : (
                      <Link
                        key={d.label}
                        href={d.href}
                        className="block rounded-md px-3.5 py-2 text-[13px] text-ink-mid transition hover:bg-gold-pale hover:text-maroon"
                      >
                        {d.label}
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SearchBar />

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-lg border border-gold/25 bg-white px-3.5 py-2 text-[13px] font-medium text-ink-mid transition hover:border-gold hover:bg-gold-pale hover:text-maroon"
              >
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="hidden rounded-lg bg-gold px-3.5 py-2 text-[13px] font-medium text-maroon-dark transition hover:bg-gold-light sm:block"
              >
                Sign Up
              </button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <Link
              href="/account"
              className="hidden rounded-lg border border-gold/25 bg-white px-3.5 py-2 text-[13px] font-medium text-ink-mid transition hover:border-gold hover:bg-gold-pale hover:text-maroon sm:block"
            >
              My Account
            </Link>
            <UserButton
              appearance={{ elements: { avatarBox: "h-9 w-9" } }}
            />
          </Show>

          <CartButton />
        </div>
      </div>
    </nav>
  );
}
