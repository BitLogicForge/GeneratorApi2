import type pptxgen from 'pptxgenjs';
import type { PresentationInput } from '../../schemas.js';

export type PresentationTemplate = (
  deck: pptxgen,
  input: PresentationInput,
) => void | Promise<void>;
