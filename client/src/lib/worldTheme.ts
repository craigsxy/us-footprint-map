/**
 * Visual constants for the world map. Lit colours run cool -> warm -> hot so the
 * three levels read as intensity on top of the green/tan terrain.
 */
import type { FootprintStatus } from "@/lib/footprintData";

export type LitStatus = Exclude<FootprintStatus, "unvisited">;

export const LIT_ORDER: LitStatus[] = ["transit", "trip", "longstay"];

export const LIT: Record<LitStatus, { color: string; label: string; hint: string }> = {
  transit: { color: "#5E5CE6", label: "路过", hint: "转机、路过" },
  trip: { color: "#FF9F0A", label: "短途", hint: "旅行、出差" },
  longstay: { color: "#FF2D55", label: "长住", hint: "生活、求学" },
};

export const UI_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Segoe UI", "Microsoft YaHei", sans-serif';

/** CSS font-family the map uses to draw CJK labels locally */
export const MAP_CJK_FONT = '-apple-system, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif';

export const OCEAN = "#7fb3d8";
