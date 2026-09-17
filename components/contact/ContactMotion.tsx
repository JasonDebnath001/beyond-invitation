"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import gsap from "gsap";

type ContactMotionApi = {
  expand: (el: HTMLElement) => void;
  collapse: (el: HTMLElement) => void;
  countTo: (el: HTMLElement, value: number, format: (value: number) => string) => void;
  drawCheck: (svg: SVGSVGElement) => void;
};

const immediate: ContactMotionApi = {
  expand: el => { el.hidden = false; },
  collapse: el => { el.hidden = true; },
  countTo: (el, value, format) => { el.textContent = format(value); },
  drawCheck: () => {},
};
const MotionContext = createContext<ContactMotionApi>(immediate);
export const useContactMotion = () => useContext(MotionContext);

export function ContactMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const actions = useRef<ContactMotionApi>(immediate);
  const api = useMemo<ContactMotionApi>(() => ({
    expand: el => actions.current.expand(el),
    collapse: el => actions.current.collapse(el),
    countTo: (el, value, format) => actions.current.countTo(el, value, format),
    drawCheck: svg => actions.current.drawCheck(svg),
  }), []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const panels = new Map<HTMLElement, boolean>();
    const counters = new Map<HTMLElement, { proxy: { value: number }; target: number; format: (value: number) => string }>();
    let entered = false;
    const ctx = gsap.context(() => {}, root);
    const media = gsap.matchMedia();

    media.add({ reduce: "(prefers-reduced-motion: reduce)", normal: "(prefers-reduced-motion: no-preference)" }, mediaContext => {
      const reduced = !!mediaContext.conditions?.reduce;
      ctx.add(() => {
        const targets = root.querySelectorAll("[data-motion]");
        const rule = root.querySelector("[data-header-rule]");
        if (reduced || entered) {
          gsap.set(targets, { autoAlpha: 1, clearProps: "transform,opacity,visibility" });
          if (rule) gsap.set(rule, { scaleX: 1 });
        } else {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
          const reveal = (selector: string, from: gsap.TweenVars, to: gsap.TweenVars, position: number) => {
            const elements = root.querySelectorAll(selector);
            if (elements.length) tl.fromTo(elements, from, { ...to, clearProps: "transform,opacity,visibility" }, position);
          };
          if (rule) tl.fromTo(rule, { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.9, ease: "power3.inOut" }, 0);
          reveal('[data-motion="eyebrow"]', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.05);
          reveal('[data-motion="heading-word"]', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power4.out", stagger: 0.05 }, 0.15);
          reveal('[data-motion="intro"]', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.4);
          reveal('[data-motion="channel"]', { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.07 }, 0.5);
          reveal('[data-motion="form-card"]', { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.35);
          reveal('[data-motion="product-banner"]', { autoAlpha: 0, scale: 0.98 }, { autoAlpha: 1, scale: 1, duration: 0.5 }, 0.7);
        }
        entered = true;
        panels.forEach((open, el) => {
          el.hidden = !open;
          gsap.set(el, { clearProps: "height,overflow,opacity,visibility" });
        });
        counters.forEach(({ proxy, target, format }, el) => {
          proxy.value = target;
          el.textContent = format(target);
        });
        const checkPaths = root.querySelectorAll("[data-enquiry-success] circle, [data-enquiry-success] path");
        if (checkPaths.length) gsap.set(checkPaths, { strokeDashoffset: 0 });
      });

      actions.current = {
        expand(el) {
          panels.set(el, true);
          ctx.add(() => {
            gsap.killTweensOf(el);
            const wasHidden = el.hidden;
            el.hidden = false;
            if (reduced) {
              gsap.set(el, { clearProps: "height,overflow,opacity,visibility" });
              return;
            }
            gsap.set(el, { overflow: "hidden", ...(wasHidden ? { height: 0, autoAlpha: 0 } : {}) });
            gsap.to(el, { height: "auto", autoAlpha: 1, duration: 0.35, ease: "power2.out", clearProps: "height,overflow,opacity,visibility" });
          });
        },
        collapse(el) {
          panels.set(el, false);
          ctx.add(() => {
            gsap.killTweensOf(el);
            if (reduced || el.hidden) {
              el.hidden = true;
              gsap.set(el, { clearProps: "height,overflow,opacity,visibility" });
              return;
            }
            gsap.set(el, { overflow: "hidden" });
            gsap.to(el, { height: 0, autoAlpha: 0, duration: 0.25, ease: "power2.in", onComplete: () => {
              el.hidden = true;
              gsap.set(el, { clearProps: "height,overflow,opacity,visibility" });
            } });
          });
        },
        countTo(el, value, format) {
          const previous = counters.get(el);
          const proxy = previous?.proxy || { value: 0 };
          gsap.killTweensOf(proxy);
          counters.set(el, { proxy, target: value, format });
          ctx.add(() => {
            if (reduced) {
              proxy.value = value;
              el.textContent = format(value);
              return;
            }
            gsap.to(proxy, { value, duration: 0.6, ease: "power2.out", snap: { value: 1 }, onUpdate: () => { el.textContent = format(proxy.value); }, onComplete: () => { el.textContent = format(value); } });
          });
        },
        drawCheck(svg) {
          ctx.add(() => {
            const circle = svg.querySelector("circle");
            const tick = svg.querySelector("path");
            const card = svg.closest("[data-enquiry-success]")?.querySelector("[data-success-content]");
            if (!circle || !tick || !card) return;
            gsap.killTweensOf([circle, tick, card]);
            if (reduced) {
              gsap.set([circle, tick], { strokeDashoffset: 0 });
              gsap.set(card, { autoAlpha: 1, clearProps: "transform,opacity,visibility" });
              return;
            }
            const tl = gsap.timeline();
            for (const [path, duration, start] of [[circle, 0.6, 0], [tick, 0.35, 0.4]] as const) {
              const length = path.getTotalLength();
              tl.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration, ease: "power2.inOut" }, start);
            }
            tl.fromTo(card, { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity,visibility" }, 0.75);
          });
        },
      };
      return () => {
        ctx.revert();
        actions.current = immediate;
      };
    });

    return () => {
      media.revert();
      ctx.revert();
      panels.clear();
      counters.clear();
      actions.current = immediate;
    };
  }, []);

  return (
    <MotionContext.Provider value={api}>
      <main ref={rootRef} data-contact-page data-no-text-motion className="min-h-screen overflow-x-clip bg-[#fbf6ee] text-ink">{children}</main>
    </MotionContext.Provider>
  );
}
