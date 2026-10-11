import type pptxgen from 'pptxgenjs';
import type { BriefInput } from '@/routes/api/exports/pptx/pptxgenjs/brief/schema';

export type PresentationTemplate = (
  deck: pptxgen,
  input: BriefInput,
) => void | Promise<void>;
