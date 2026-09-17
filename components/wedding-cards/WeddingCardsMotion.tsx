"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import gsap from "gsap";
import type { Flip } from "gsap/Flip";

type MotionApi = {
  revealNew: () => void;
  reorderStart: () => void;
  reorderEnd: () => void;
  expand: (element: HTMLElement) => void;
  collapse: (element: HTMLElement) => void;
  openSheet: (element: HTMLElement, backdrop: HTMLElement) => void;
  closeSheet: (element: HTMLElement, backdrop: HTMLElement) => void;
};
const immediate: MotionApi = {
  revealNew() {},
  reorderStart() {},
  reorderEnd() {},
  expand: (element) => {
    element.hidden = false;
  },
  collapse: (element) => {
    element.hidden = true;
  },
  openSheet: (element, backdrop) => {
    element.hidden = false;
    backdrop.hidden = false;
  },
  closeSheet: (element, backdrop) => {
    element.hidden = true;
    backdrop.hidden = true;
  },
};
const MotionContext = createContext<MotionApi>(immediate);
export const useWeddingCardsMotion = () => useContext(MotionContext);

export function WeddingCardsMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const actions = useRef<MotionApi>(immediate);
  const api = useMemo<MotionApi>(
    () => ({
      revealNew: () => actions.current.revealNew(),
      reorderStart: () => actions.current.reorderStart(),
      reorderEnd: () => actions.current.reorderEnd(),
      expand: (el) => actions.current.expand(el),
      collapse: (el) => actions.current.collapse(el),
      openSheet: (el, backdrop) => actions.current.openSheet(el, backdrop),
      closeSheet: (el, backdrop) => actions.current.closeSheet(el, backdrop),
    }),
    [],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let previousOverflow: string | null = null;
    const panels = new Map<HTMLElement, boolean>();
    let sheetState: {
      element: HTMLElement;
      backdrop: HTMLElement;
      open: boolean;
    } | null = null;
    const lockScroll = () => {
      if (previousOverflow === null)
        previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    };
    const unlockScroll = () => {
      if (previousOverflow !== null)
        document.body.style.overflow = previousOverflow;
      previousOverflow = null;
    };
    const find = (selector: string) =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-wedding-browser][data-motion-ready] ${selector}`));
    const visible = {
      autoAlpha: 1,
      clearProps: "transform,opacity,visibility",
    };
    const ctx = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          normal: "(prefers-reduced-motion: no-preference)",
        },
        (motionContext) => {
          const reduced = !!motionContext.conditions?.reduce;
          let disposed = false;
          let flip: typeof Flip | null = null;
          let pending: Flip.FlipState | null = null;
          let flipTween: gsap.core.Timeline | null = null;
          let revealCards = () => {};
          const revealing = new WeakSet<Element>();
          const triggers = new Set<{ kill: () => void; trigger?: Element }>();
          const setIfAny = (elements: HTMLElement[], vars: gsap.TweenVars) => {
            if (elements.length) gsap.set(elements, vars);
          };

          function animatePanel(element: HTMLElement, open: boolean) {
            panels.set(element, open);
            motionContext.add(() => {
              gsap.killTweensOf(element);
              const wasHidden = element.hidden;
              if (reduced || (!open && wasHidden)) {
                element.hidden = !open;
                gsap.set(element, {
                  clearProps: "height,overflow,opacity,visibility",
                });
                return;
              }
              element.hidden = false;
              gsap.set(element, {
                overflow: "hidden",
                ...(open && wasHidden ? { height: 0, autoAlpha: 0 } : {}),
              });
              gsap.to(element, {
                height: open ? "auto" : 0,
                autoAlpha: open ? 1 : 0,
                duration: open ? 0.35 : 0.25,
                ease: open ? "power2.out" : "power2.in",
                onComplete: () => {
                  element.hidden = !open;
                  gsap.set(element, {
                    clearProps: "height,overflow,opacity,visibility",
                  });
                },
              });
            });
          }

          function animateSheet(
            element: HTMLElement,
            backdrop: HTMLElement,
            open: boolean,
          ) {
            sheetState = { element, backdrop, open };
            motionContext.add(() => {
              gsap.killTweensOf([element, backdrop]);
              if (open) lockScroll();
              if (reduced) {
                element.hidden = !open;
                backdrop.hidden = !open;
                gsap.set([element, backdrop], {
                  clearProps: "transform,opacity,visibility",
                });
                if (!open) unlockScroll();
                return;
              }
              if (open) {
                const wasHidden = element.hidden;
                element.hidden = false;
                backdrop.hidden = false;
                if (wasHidden) {
                  gsap.set(element, { xPercent: -100 });
                  gsap.set(backdrop, { autoAlpha: 0 });
                }
                gsap.to(element, {
                  xPercent: 0,
                  duration: 0.4,
                  ease: "power3.out",
                  clearProps: "transform",
                });
                gsap.to(backdrop, {
                  autoAlpha: 1,
                  duration: 0.3,
                  clearProps: "opacity,visibility",
                });
              } else {
                gsap.to(backdrop, { autoAlpha: 0, duration: 0.3 });
                gsap.to(element, {
                  xPercent: -100,
                  duration: 0.4,
                  ease: "power3.in",
                  onComplete: () => {
                    element.hidden = true;
                    backdrop.hidden = true;
                    gsap.set([element, backdrop], {
                      clearProps: "transform,opacity,visibility",
                    });
                    unlockScroll();
                  },
                });
              }
            });
          }

          actions.current = {
            revealNew: () =>
              motionContext.add(() => {
                if (reduced) {
                  const cards = find("[data-card]");
                  setIfAny(cards, visible);
                  cards.forEach((card) => {
                    card.dataset.revealed = "true";
                  });
                } else revealCards();
              }),
            reorderStart: () =>
              motionContext.add(() => {
                pending = null;
                flipTween?.kill();
                const cards = find("[data-card]");
                if (cards.length) {
                  gsap.killTweensOf(cards);
                  gsap.set(cards, visible);
                }
                cards.forEach((card) => {
                  card.dataset.revealed = "true";
                });
                if (!reduced && flip && cards.length <= 96)
                  pending = flip.getState(cards);
              }),
            reorderEnd: () =>
              motionContext.add(() => {
                if (!pending || !flip || reduced) {
                  pending = null;
                  return;
                }
                const state = pending;
                pending = null;
                if (find("[data-card]").length > 96) {
                  revealCards();
                  return;
                }
                flipTween?.kill();
                flipTween = flip.from(state, {
                  duration: 0.45,
                  ease: "power2.inOut",
                  stagger: 0.01,
                  onEnter: (elements) => {
                    elements.forEach((element) => revealing.add(element));
                    return gsap.fromTo(
                      elements,
                      { autoAlpha: 0, scale: 0.96 },
                      {
                        autoAlpha: 1,
                        scale: 1,
                        duration: 0.35,
                        clearProps: "transform,opacity,visibility",
                        onComplete: () =>
                          elements.forEach((element) =>
                            element.setAttribute("data-revealed", "true"),
                          ),
                      },
                    );
                  },
                  onLeave: (elements) =>
                    gsap.to(elements, {
                      autoAlpha: 0,
                      scale: 0.96,
                      duration: 0.2,
                    }),
                });
              }),
            expand: (element) => animatePanel(element, true),
            collapse: (element) => animatePanel(element, false),
            openSheet: (element, backdrop) =>
              animateSheet(element, backdrop, true),
            closeSheet: (element, backdrop) =>
              animateSheet(element, backdrop, false),
          };

          if (reduced) actions.current.revealNew();
          panels.forEach((open, element) => {
            element.hidden = !open;
            gsap.set(element, {
              clearProps: "height,overflow,opacity,visibility",
            });
          });
          if (sheetState) {
            const { element, backdrop, open } = sheetState;
            element.hidden = !open;
            backdrop.hidden = !open;
            gsap.set([element, backdrop], {
              clearProps: "transform,opacity,visibility",
            });
            if (open) lockScroll();
            else unlockScroll();
          }

          if (!reduced)
            void (async () => {
              try {
                const [{ ScrollTrigger }, { Flip: plugin }] = await Promise.all(
                  [import("gsap/ScrollTrigger"), import("gsap/Flip")],
                );
                if (disposed) return;
                gsap.registerPlugin(ScrollTrigger, plugin);
                flip = plugin;
                motionContext.add(() => {
                  revealCards = () => {
                    triggers.forEach((trigger) => {
                      if (trigger.trigger && !trigger.trigger.isConnected) {
                        trigger.kill();
                        triggers.delete(trigger);
                      }
                    });
                    const cards = find(
                      "[data-card]:not([data-revealed])",
                    ).filter((card) => !revealing.has(card));
                    if (!cards.length) return;
                    cards.forEach((card) => revealing.add(card));
                    ScrollTrigger.batch(cards, {
                      start: "top 92%",
                      once: true,
                      onEnter: (batch) =>
                        motionContext.add(() => {
                          const entering = batch.filter(
                            (card) =>
                              card.isConnected &&
                              !card.hasAttribute("data-revealed"),
                          );
                          if (!entering.length) return;
                          gsap.fromTo(
                            entering,
                            { autoAlpha: 0, y: 10 },
                            {
                              autoAlpha: 1,
                              y: 0,
                              duration: 0.3,
                              stagger: 0.025,
                              ease: "power3.out",
                              clearProps: "transform,opacity,visibility",
                              onComplete: () =>
                                entering.forEach((card) =>
                                  card.setAttribute("data-revealed", "true"),
                                ),
                            },
                          );
                        }),
                    }).forEach((trigger) => triggers.add(trigger));
                  };
                  revealCards();
                });
              } catch {
                // All content stays visible and usable if an optional motion chunk fails.
              }
            })();

          return () => {
            disposed = true;
            flipTween?.kill();
            triggers.forEach((trigger) => trigger.kill());
            actions.current = immediate;
          };
        },
      );
      return () => media.revert();
    }, root);
    return () => {
      ctx.revert();
      unlockScroll();
      panels.clear();
      actions.current = immediate;
    };
  }, []);

  return (
    <MotionContext.Provider value={api}>
      <main
        ref={rootRef}
        data-wedding-cards-page
        data-no-text-motion
        className="min-h-screen overflow-x-clip bg-[#faf8f5] text-ink"
      >
        {children}
      </main>
    </MotionContext.Provider>
  );
}
