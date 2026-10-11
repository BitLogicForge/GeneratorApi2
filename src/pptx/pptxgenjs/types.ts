import type pptxgen from 'pptxgenjs';
import type { PresentationInput } from '@/schemas';

export type PresentationTemplate = (
  deck: pptxgen,
  input: PresentationInput,
) => void | Promise<void>;
