"use client";

import type { Transition } from "motion/react";
import { motionTokens, useChoreography } from "#/lib/cojeev-motion/choreography.ts";
import { getSettingsSnapshot } from "#/lib/cojeev-motion/settings.ts";

/** Data dimensions cannot overshoot below zero as decorative springs can. */
export function useChartMotion() {
  const choreography = useChoreography();
  const geometryTransition: Transition = {
    type: "tween",
    duration: choreography.quiet ? 0 : motionTokens.duration.enter / getSettingsSnapshot().flow.speed,
    ease: motionTokens.ease.enter,
  };
  return { ...choreography, geometryTransition };
}
