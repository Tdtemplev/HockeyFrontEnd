export const BOX_FORMATS = [
  { id: "hobby_box", label: "Hobby box" },
  { id: "blaster_box", label: "Blaster" },
  { id: "mega_box", label: "Mega box" },
  { id: "retail_box", label: "Retail box" },
  { id: "hanger", label: "Hanger / fat pack" },
  { id: "tin", label: "Tin" },
  { id: "hobby_case", label: "Hobby case" },
  { id: "retail_case", label: "Retail case" },
] as const;

export type BoxFormatId = (typeof BOX_FORMATS)[number]["id"];

export function formatBoxLabel(format: string): string {
  return (
    BOX_FORMATS.find((entry) => entry.id === format)?.label ??
    format.replaceAll("_", " ")
  );
}

export function matchesBoxFormats(
  productFormat: string,
  formats?: string[],
): boolean {
  if (!formats?.length) return true;
  return formats.includes(productFormat);
}
