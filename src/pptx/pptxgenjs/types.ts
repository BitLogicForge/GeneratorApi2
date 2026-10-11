import type pptxgen from 'pptxgenjs';
import type { PresentationInput } from '../../schemas.ts';

export type PresentationTemplate = (
  deck: pptxgen,
  input: PresentationInput,
) => void | Promise<void>;
