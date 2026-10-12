import type pptxgen from 'pptxgenjs';
import type { BriefInput } from '@/services/pptxgenjs/contracts';

export type PresentationTemplate = (
  deck: pptxgen,
  input: BriefInput,
) => void | Promise<void>;
