import { definePptxReport } from '@/reports/pptx';
import { templateReport } from '@/reports/template';

export const report = templateReport('summary');
export default definePptxReport(report);
