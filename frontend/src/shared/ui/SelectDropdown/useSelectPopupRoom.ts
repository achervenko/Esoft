import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { getSelectScrollContainer } from "./select-scroll-container";

export function useSelectPopupRoom({
  triggerRef,
  isOpen,
  disabled,
  alwaysDown,
  optionCountRef,
  updateMenuPosition,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  disabled: boolean;
  alwaysDown: boolean;
  optionCountRef: RefObject<number>;
  updateMenuPosition: () => void;
}) {
  const [makingRoom, setMakingRoom] = useState(false);
  const moving = useRef(false);
  const finishReturn = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (isOpen) {
      finishReturn.current?.();
      finishReturn.current = null;
    }
    moving.current = false;
    setMakingRoom(false);
    if (!alwaysDown || !isOpen || disabled) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const viewport = window.visualViewport;
    const bottom =
      (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
    // Reserve once per opening; filtering must not rebuild space or replay scroll.
    const height = Math.min(280, Math.max(42, optionCountRef.current * 42) + 2);
    const rect = trigger.getBoundingClientRect();
    const form = getSelectScrollContainer(trigger);
    const container = form ?? document.body;
    const visibleBottom = form
      ? Math.min(bottom, form.getBoundingClientRect().bottom)
      : bottom;
    const missing = Math.max(0, rect.bottom + height + 18 - visibleBottom);
    const remainingScroll = form
      ? form.scrollHeight - form.clientHeight - form.scrollTop
      : Math.max(
          0,
          document.documentElement.scrollHeight -
            window.innerHeight -
            window.scrollY,
        );
    const extra = Math.max(0, missing - remainingScroll);
    let spacer: HTMLDivElement | undefined;
    if (extra > 0) {
      spacer = document.createElement("div");
      spacer.dataset.selectDropdownSpace = "";
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.height = "0px";
      spacer.style.minHeight = "0";
      spacer.style.margin = "0";
      const gap = parseFloat(getComputedStyle(container).rowGap) || 0;
      spacer.style.marginTop = `${-gap}px`;
      spacer.style.padding = "0";
      spacer.style.overflowAnchor = "none";
      spacer.style.flexShrink = "0";
      container.append(spacer);
    }
    let frame: number | undefined;
    if (missing > 0) {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const start = form ? form.scrollTop : window.scrollY;
      const scrollTo = (top: number) => {
        if (form) form.scrollTop = top;
        else window.scrollTo({ top, behavior: "instant" });
      };
      if (reducedMotion) {
        if (spacer) spacer.style.height = `${extra}px`;
        scrollTo(start + missing);
      } else {
        moving.current = true;
        setMakingRoom(true);
        let started: number | undefined;
        const animate = (time: number) => {
          started ??= time;
          const progress = Math.min(1, (time - started) / 260);
          const eased = progress * progress * (3 - 2 * progress);
          if (spacer) spacer.style.height = `${extra * eased}px`;
          scrollTo(start + missing * eased);
          if (progress < 1) frame = requestAnimationFrame(animate);
          else {
            moving.current = false;
            updateMenuPosition();
            setMakingRoom(false);
          }
        };
        frame = requestAnimationFrame(animate);
      }
    }
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      moving.current = false;
      if (!spacer) return;
      const returningSpacer = spacer;
      const currentHeight = parseFloat(returningSpacer.style.height) || 0;
      if (
        !trigger.isConnected ||
        currentHeight === 0 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        returningSpacer.remove();
        return;
      }
      const initialScroll = form ? form.scrollTop : window.scrollY;
      const scrollBack = Math.min(currentHeight, initialScroll);
      let started: number | undefined;
      let returnFrame: number;
      const finish = () => {
        cancelAnimationFrame(returnFrame);
        returningSpacer.remove();
      };
      finishReturn.current = finish;
      const animateReturn = (time: number) => {
        if (!trigger.isConnected) {
          finish();
          return;
        }
        started ??= time;
        const progress = Math.min(1, (time - started) / 260);
        const eased = progress * progress * (3 - 2 * progress);
        const top = initialScroll - scrollBack * eased;
        if (form) form.scrollTop = top;
        else window.scrollTo({ top, behavior: "instant" });
        returningSpacer.style.height = `${currentHeight * (1 - eased)}px`;
        if (progress < 1) returnFrame = requestAnimationFrame(animateReturn);
        else {
          returningSpacer.remove();
          finishReturn.current = null;
        }
      };
      returnFrame = requestAnimationFrame(animateReturn);
    };
  }, [
    alwaysDown,
    isOpen,
    disabled,
    triggerRef,
    optionCountRef,
    updateMenuPosition,
  ]);

  useLayoutEffect(
    () => () => {
      finishReturn.current?.();
      finishReturn.current = null;
    },
    [],
  );

  return makingRoom || moving.current;
}
