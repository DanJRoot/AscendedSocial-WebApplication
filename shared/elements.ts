// Element category mapping constants (colors, icons, descriptions)
import type { ElementCategory } from "./types";

export interface ElementConfig {
  name: ElementCategory;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  gradientFrom: string;
  gradientTo: string;
  icon: string;
  emoji: string;
  description: string;
}

export const elementConfigs: Record<ElementCategory, ElementConfig> = {
  Water: {
    name: "Water",
    color: "#3B82F6",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    textColor: "text-blue-700",
    gradientFrom: "from-blue-400",
    gradientTo: "to-cyan-500",
    icon: "Droplets",
    emoji: "💧",
    description: "Flow, emotion, intuition, adaptability — content that soothes, inspires reflection, and encourages emotional depth.",
  },
  Fire: {
    name: "Fire",
    color: "#EF4444",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    textColor: "text-red-700",
    gradientFrom: "from-red-400",
    gradientTo: "to-orange-500",
    icon: "Flame",
    emoji: "🔥",
    description: "Passion, energy, transformation, willpower — content that motivates, energizes, and sparks action.",
  },
  Earth: {
    name: "Earth",
    color: "#22C55E",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    textColor: "text-green-700",
    gradientFrom: "from-green-400",
    gradientTo: "to-emerald-500",
    icon: "Mountain",
    emoji: "🌍",
    description: "Stability, grounding, nurture, growth — content that centers, grounds, and connects to nature and physical well-being.",
  },
  Air: {
    name: "Air",
    color: "#A855F7",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    textColor: "text-purple-700",
    gradientFrom: "from-purple-400",
    gradientTo: "to-violet-500",
    icon: "Wind",
    emoji: "💨",
    description: "Intellect, communication, freedom, perspective — content that expands thinking, encourages open dialogue, and broadens horizons.",
  },
  Spiritual: {
    name: "Spiritual",
    color: "#F59E0B",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
    textColor: "text-amber-700",
    gradientFrom: "from-amber-400",
    gradientTo: "to-yellow-500",
    icon: "Sparkles",
    emoji: "✨",
    description: "Transcendence, unity, divine connection, higher consciousness — content that elevates the spirit and deepens spiritual practice.",
  },
};

export const elementCategoryList: ElementCategory[] = [
  "Water",
  "Fire",
  "Earth",
  "Air",
  "Spiritual",
];

export function getElementConfig(category: ElementCategory): ElementConfig {
  return elementConfigs[category];
}
