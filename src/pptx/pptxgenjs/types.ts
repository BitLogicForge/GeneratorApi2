import type pptxgen from 'pptxgenjs';
import type { BriefInput } from '@/services/pptxgenjs/schema';

export type PresentationLayout = (deck: pptxgen, input: BriefInput) => void | Promise<void>;
