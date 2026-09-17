"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import gsap from "gsap";
import type { Flip } from "gsap/Flip";

type MotionActions = {
  removeCard: (element: HTMLElement, commit: () => void) => void;
  reorderStart: () => void;
  reorderEnd: () => void;
};
const immediate: MotionActions = { removeCard: (_element, commit) => commit(), reorderStart() {}, reorderEnd() {} };
const WishlistMotionContext = createContext<MotionActions>(immediate);
export const useWishlistMotion = () => useContext(WishlistMotionContext);

export function WishlistMotion({ children, count, renderedSlugs, phase = "ready" }: {
  children: ReactNode; count: number; renderedSlugs: string[]; phase?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const actions = useRef<MotionActions>(immediate);
  const refresh = useRef(() => {});
  const pulse = useRef(() => {});
  const playRemoval = useRef(() => {});
  const previousCount = useRef(count);
  const slugKey = JSON.stringify(renderedSlugs);
  const contextValue = useMemo<MotionActions>(() => ({
    removeCard: (element, commit) => actions.current.removeCard(element, commit),
    reorderStart: () => actions.current.reorderStart(),
    reorderEnd: () => actions.current.reorderEnd(),
  }), []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let mounted = true;
    const ctx = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add({ reduce: "(prefers-reduced-motion: reduce)", animate: "(prefers-reduced-motion: no-preference)" }, (motionContext) => {
        const reduced = !!motionContext.conditions?.reduce;
        let disposed = false;
        let flip: typeof Flip | null = null;
        let pending: { state: Flip.FlipState; kind: "remove" | "sort" } | null = null;
        let flipTween: gsap.core.Timeline | null = null;
        let revealCards: () => void = () => {};
        const revealing = new WeakSet<Element>();
        const simpleReveals = new WeakSet<Element>();
        const removals = new Map<HTMLElement, () => void>();
        const frames = new Set<number>();
        const find = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
        const finalState = { autoAlpha: 1, y: 0, scale: 1, clearProps: "transform,opacity" };

        const refreshContent = () => motionContext.add(() => {
          const simple = find('[data-motion="skeleton"], [data-motion="empty"], [data-motion="nudge"], [data-motion="toolbar"]')
            .filter((node) => !simpleReveals.has(node));
          simple.forEach((node) => simpleReveals.add(node));
          if (reduced) {
            gsap.set(find("[data-motion], [data-wishlist-card]"), finalState);
            gsap.set(find("[data-header-rule]"), { scaleX: 1 });
          } else {
            if (simple.length) gsap.fromTo(simple, { autoAlpha: 0, y: 10 }, { ...finalState, duration: 0.45, stagger: 0.06, ease: "power3.out" });
            revealCards();
          }
        });
        refresh.current = refreshContent;

        const play = (kind: "remove" | "sort") => motionContext.add(() => {
          if (reduced || !flip || pending?.kind !== kind) return;
          const state = pending.state;
          pending = null;
          flipTween?.kill();
          flipTween = flip.from(state, {
            duration: kind === "remove" ? 0.45 : 0.5, ease: "power2.inOut", nested: true,
            ...(kind === "sort" ? { stagger: 0.01 } : {}),
          });
        });
        playRemoval.current = () => play("remove");
        actions.current = {
          removeCard(element, commit) {
            if (removals.has(element)) return;
            if (reduced) { commit(); return; }
            motionContext.add(() => {
              flipTween?.kill();
              const others = find("[data-wishlist-card]").filter((node) => node !== element);
              const state = flip?.getState(others);
              gsap.killTweensOf(element);
              removals.set(element, commit);
              gsap.to(element, { scale: 0.96, autoAlpha: 0, duration: 0.28, ease: "power2.in", onComplete: () => {
                removals.delete(element);
                if (state) pending = { state, kind: "remove" };
                commit();
                // A sync lock or rollback can leave the card mounted. Never leave it invisible.
                const frame = requestAnimationFrame(() => {
                  frames.delete(frame);
                  if (!disposed && root.contains(element)) motionContext.add(() => gsap.set(element, finalState));
                });
                frames.add(frame);
              } });
            });
          },
          reorderStart() {
            if (reduced || !flip) return;
            motionContext.add(() => {
              flipTween?.kill();
              const cards = find("[data-wishlist-card]");
              gsap.killTweensOf(cards);
              gsap.set(cards, finalState);
              cards.forEach((card) => { card.dataset.revealed = "true"; });
              if (flip) pending = { state: flip.getState(cards), kind: "sort" };
            });
          },
          reorderEnd: () => play("sort"),
        };
        pulse.current = () => motionContext.add(() => {
          const pill = find('[data-motion="count"]');
          if (!pill.length) return;
          gsap.killTweensOf(pill);
          if (reduced) gsap.set(pill, { scale: 1, autoAlpha: 1 });
          else gsap.fromTo(pill, { scale: 1, autoAlpha: 1 }, { scale: 1.12, duration: 0.175, yoyo: true, repeat: 1, ease: "power2.inOut", clearProps: "transform,opacity" });
        });

        if (reduced) {
          refreshContent();
        } else {
          const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
          const reveal = { autoAlpha: 1, y: 0, clearProps: "transform,opacity" };
          timeline
            .fromTo(find("[data-header-rule]"), { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.9, ease: "power3.inOut", clearProps: "transform,opacity" }, 0)
            .fromTo(find('[data-motion="eyebrow"]'), { autoAlpha: 0, y: 8 }, { ...reveal, duration: 0.4 }, 0.05)
            .fromTo(find('[data-motion="heading-word"]'), { autoAlpha: 0, y: 24 }, { ...reveal, duration: 0.7, ease: "power4.out", stagger: 0.05 }, 0.15)
            .fromTo(find('[data-motion="count"]'), { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(1.6)", clearProps: "transform,opacity" }, 0.4)
            .fromTo(find('[data-motion="meta"], [data-motion="nudge"], [data-motion="toolbar"]'), { autoAlpha: 0, y: 10 }, { ...reveal, duration: 0.45, stagger: 0.06 }, 0.45);
          find('[data-motion="nudge"], [data-motion="toolbar"]').forEach((node) => simpleReveals.add(node));
          refreshContent();
          void (async () => {
            try {
              const [{ ScrollTrigger }, { Flip: plugin }] = await Promise.all([import("gsap/ScrollTrigger"), import("gsap/Flip")]);
              if (disposed) return;
              gsap.registerPlugin(ScrollTrigger, plugin);
              flip = plugin;
              const triggers = new Set<ReturnType<typeof ScrollTrigger.create>>();
              revealCards = () => {
                triggers.forEach((trigger) => { if (!trigger.trigger?.isConnected) { trigger.kill(); triggers.delete(trigger); } });
                const cards = find("[data-wishlist-card]:not([data-revealed])").filter((card) => !revealing.has(card));
                if (!cards.length) return;
                cards.forEach((card) => revealing.add(card));
                ScrollTrigger.batch(cards, { start: "top 92%", once: true,
                  onEnter: (batch) => motionContext.add(() => {
                    const entering = batch.filter((card) => card.isConnected && !card.hasAttribute("data-revealed"));
                    if (!entering.length) return;
                    gsap.fromTo(entering, { autoAlpha: 0, y: 24 }, { ...reveal, duration: 0.55, stagger: 0.06, ease: "power3.out",
                      onComplete: () => entering.forEach((card) => card.setAttribute("data-revealed", "true")) });
                  }),
                }).forEach((trigger) => triggers.add(trigger));
              };
              refreshContent();
            } catch {
              // Cards have no CSS-hidden state and remain usable if a motion chunk fails.
            }
          })();
        }

        return () => {
          disposed = true;
          frames.forEach((frame) => cancelAnimationFrame(frame));
          flipTween?.kill();
          pending = null;
          actions.current = immediate;
          refresh.current = () => {};
          pulse.current = () => {};
          playRemoval.current = () => {};
          // Finish on a motion-preference change, but never mutate the list after unmount.
          if (mounted) removals.forEach((commit) => commit());
          removals.clear();
        };
      });
      return () => media.revert();
    }, root);
    return () => { mounted = false; ctx.revert(); };
  }, []);

  // Read positions only after React has committed its keyed card list to the DOM.
  useLayoutEffect(() => { playRemoval.current(); refresh.current(); }, [slugKey, phase]);
  useLayoutEffect(() => {
    if (previousCount.current !== count) { previousCount.current = count; pulse.current(); }
  }, [count]);

  return (
    <WishlistMotionContext.Provider value={contextValue}>
      <div ref={rootRef} data-wishlist-page data-no-text-motion className="relative min-h-screen overflow-x-clip bg-[#fbf6ee] text-ink motion-reduce:[&_*]:!animate-none motion-reduce:[&_*]:!transition-none">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-[#dcb162]/10 blur-3xl" />
        {children}
      </div>
    </WishlistMotionContext.Provider>
  );
}
