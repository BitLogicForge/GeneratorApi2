export interface PdfInput {
  route: string;
  query: Record<string, string | number | boolean>;
  filename: string;
  waitForSelector?: string;
  format: 'A4' | 'Letter';
  landscape: boolean;
}
export interface PresentationInput {
  filename: string;
  title: string;
  subtitle: string;
  author: string;
  accent: string;
  slides: { title: string; bullets: string[]; notes?: string }[];
}
export interface TemplatePresentationInput {
  filename: string;
  replacements: Record<string, string>;
}
