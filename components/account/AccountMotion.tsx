"use client";

import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

type PanelMotion = { open: (panel: HTMLElement) => void; close: (panel: HTMLElement) => void };
const MotionContext = createContext<PanelMotion>({ open() {}, close() {} });
export const useAccountMotion = () => useContext(MotionContext);

export default function AccountMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelMotion = useRef<PanelMotion>({ open() {}, close() {} });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add({ reduce: "(prefers-reduced-motion: reduce)", animate: "(prefers-reduced-motion: no-preference)" }, (motionContext) => {
        const reduced = !!motionContext.conditions?.reduce;
        let disposed = false;
        const find = (selector: string) => root.querySelectorAll<HTMLElement>(selector);
        const countTweens = new Map<HTMLElement, gsap.core.Tween>();
        const setCounts = () => find("[data-count]").forEach((node) => { node.textContent = node.dataset.count || "0"; });
        const animateCount = (node: HTMLElement, delay = 0) => {
          countTweens.get(node)?.kill();
          const value = Number(node.dataset.count || 0);
          if (reduced) { node.textContent = String(value); return; }
          const proxy = { value: 0 };
          const tween = gsap.to(proxy, { value, duration: 0.8, delay, snap: { value: 1 }, ease: "power3.out",
            onUpdate: () => { node.textContent = String(proxy.value); } });
          countTweens.set(node, tween);
        };

        find("[data-order-panel]").forEach((panel) => {
          const open = panel.dataset.open === "true";
          gsap.set(panel, { height: open ? "auto" : 0, autoAlpha: open ? 1 : 0, overflow: "hidden" });
        });
        const togglePanel = (panel: HTMLElement, open: boolean) => motionContext.add(() => {
          gsap.killTweensOf(panel);
          const values = { height: open ? "auto" : 0, autoAlpha: open ? 1 : 0, overflow: "hidden" };
          if (reduced) gsap.set(panel, values);
          else gsap.to(panel, { ...values, duration: 0.35, ease: "power2.out" });
        });
        panelMotion.current = { open: (panel) => togglePanel(panel, true), close: (panel) => togglePanel(panel, false) };

        if (reduced) {
          gsap.set(find("[data-motion]"), { autoAlpha: 1, x: 0, y: 0, scale: 1, clearProps: "transform,opacity" });
          gsap.set(find("[data-header-rule]"), { scaleX: 1 });
          gsap.set(find('[data-motion="avatar-ring"]'), { strokeDashoffset: 0 });
          setCounts();
        } else {
          const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
          const reveal = { autoAlpha: 1, y: 0, clearProps: "transform,opacity" };
          timeline
            .fromTo(find("[data-header-rule]"), { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.9, ease: "power3.inOut", clearProps: "transform,opacity" }, 0)
            .fromTo(find('[data-motion="eyebrow"]'), { autoAlpha: 0, y: 8 }, { ...reveal, duration: 0.4 }, 0.05)
            .fromTo(find('[data-motion="heading-word"]'), { autoAlpha: 0, y: 24 }, { ...reveal, duration: 0.7, ease: "power4.out", stagger: 0.05 }, 0.15)
            .fromTo(find('[data-motion="avatar"]'), { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, clearProps: "transform,opacity" }, 0.2)
            .fromTo(find('[data-motion="avatar-ring"]'), { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1, ease: "power2.inOut" }, 0.25)
            .fromTo(find('[data-motion="meta"], [data-motion="rail"]'), { autoAlpha: 0, y: 10 }, { ...reveal, duration: 0.45 }, 0.45)
            .fromTo(find('[data-motion="tile"]'), { autoAlpha: 0, y: 20 }, { ...reveal, duration: 0.6, stagger: 0.07 }, 0.5);
          find("[data-count]").forEach((node, index) => animateCount(node, 0.5 + index * 0.07));

          // Import only for motion-enabled users; guard resolution after unmount or a preference change.
          void (async () => {
            try {
              const { ScrollTrigger } = await import("gsap/ScrollTrigger");
              if (disposed) return;
              gsap.registerPlugin(ScrollTrigger);
              motionContext.add(() => {
                find('[data-motion="section"]').forEach((section) => {
                  gsap.fromTo(section, { autoAlpha: 0, y: 28 }, { ...reveal, duration: 0.6, ease: "power3.out",
                    scrollTrigger: { trigger: section, start: "top 85%", once: true } });
                });
              });
            } catch {
              // The server-rendered sections stay visible if the optional motion chunk cannot load.
            }
          })();
        }

        const countsObserver = new MutationObserver((records) => motionContext.add(() => {
          records.forEach(({ target }) => animateCount(target as HTMLElement));
        }));
        countsObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ["data-count"] });
        return () => {
          disposed = true;
          countsObserver.disconnect();
          countTweens.forEach((tween) => tween.kill());
          panelMotion.current = { open() {}, close() {} };
          setCounts();
        };
      });
      return () => media.revert();
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <MotionContext.Provider value={{ open: (panel) => panelMotion.current.open(panel), close: (panel) => panelMotion.current.close(panel) }}>
      <div ref={rootRef} data-account-page data-no-text-motion className="relative min-h-screen overflow-x-clip bg-[#fbf6ee] text-ink motion-reduce:[&_*]:!animate-none motion-reduce:[&_*]:!transition-none">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-[#dcb162]/10 blur-3xl" />
        {children}
      </div>
    </MotionContext.Provider>
  );
}
