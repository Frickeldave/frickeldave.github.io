export const handmadeCategoryLabels: Record<string, string> = {
  "3D": "3D-Druck",
  EP: "Epoxidharz",
  LA: "Laser",
  SB: "Steinmasse",
  WO: "Holz",
};

export const getHandmadeCategoryLabel = (categoryCode: string): string => {
  return handmadeCategoryLabels[categoryCode] ?? categoryCode;
};
