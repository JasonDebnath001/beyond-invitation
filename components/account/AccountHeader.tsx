"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import SignOutButtons from "./SignOutButtons";

export default function AccountHeader({ firstName, monogram, email, memberSince, avatarUrl }: {
  firstName: string; monogram: string; email: string; memberSince: string; avatarUrl: string;
}) {
  const [failedAvatar, setFailedAvatar] = useState("");
  return (
    <header id="overview" className="scroll-mt-28">
      <p data-motion="eyebrow" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.26em] text-[#a7772d]">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />Your account
      </p>
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div data-motion="avatar" className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-gold-pale/70 text-2xl font-light text-carbon">
          {avatarUrl && failedAvatar !== avatarUrl ? <Image src={avatarUrl} alt="Your profile photo" fill sizes="72px" className="rounded-full object-cover p-1.5" onError={() => setFailedAvatar(avatarUrl)} /> : <span aria-label="Your initials">{monogram}</span>}
          <svg aria-hidden="true" viewBox="0 0 72 72" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 fill-none text-gold">
            <circle data-motion="avatar-ring" cx="36" cy="36" r="35" stroke="currentColor" strokeWidth="1" pathLength="100" strokeDasharray="100" strokeDashoffset="0" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[34px] font-light leading-[1.12] tracking-[-0.035em] text-[#50101f] sm:text-[40px] lg:text-[48px]">
            {`Welcome back, ${firstName}`.split(/\s+/).map((word, index) => <span key={`${word}-${index}`} className="inline-block max-w-full break-words" data-motion="heading-word">{word}{"\u00a0"}</span>)}
          </h1>
          <p data-motion="meta" className="mt-3 break-words text-sm leading-6 text-ink-mid [overflow-wrap:anywhere]">Member since {memberSince} <span className="mx-1 text-gold" aria-hidden="true">·</span> {email}</p>
          <div data-motion="meta" className="mt-3 lg:hidden"><SignOutButtons showAll={false} /></div>
        </div>
        <div data-motion="meta" className="hidden self-center lg:block"><SignOutButtons showAll={false} /></div>
      </div>
      <div data-header-rule className="mt-8 h-px bg-gradient-to-r from-gold via-gold/40 to-transparent sm:mt-10" />
    </header>
  );
}
