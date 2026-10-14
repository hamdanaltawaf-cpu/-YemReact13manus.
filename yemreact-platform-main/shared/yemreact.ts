export const BRAND = {
  ink: "#121214",
  amber: "#C1592E",
  amberLight: "#E0824B",
  coral: "#FF5A36",
  paper: "#F3EAE0",
  paperDim: "#C9BFB4",
  grey: "#6B625C",
  greyLight: "#9C9289",
} as const;

export const CATEGORY_SEED = [
  { id: "laugh", name: "ضحك", color: "#F4C430", sortOrder: 1 },
  { id: "shock", name: "صدمة", color: "#7C5CFF", sortOrder: 2 },
  { id: "anger", name: "غضب", color: "#C81E3A", sortOrder: 3 },
  { id: "surprise", name: "استغراب", color: "#2CB6C4", sortOrder: 4 },
  { id: "embarrass", name: "إحراج/صمت", color: "#F17FB2", sortOrder: 5 },
  { id: "approve", name: "موافقة", color: "#4CAF6D", sortOrder: 6 },
  { id: "reject", name: "رفض", color: "#6E8296", sortOrder: 7 },
  { id: "sarcasm", name: "سخرية", color: "#D98E04", sortOrder: 8 },
  { id: "hype", name: "حماس", color: "#E8712E", sortOrder: 9 },
] as const;

export type CategoryId = (typeof CATEGORY_SEED)[number]["id"];
