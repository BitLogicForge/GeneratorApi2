import { mkdir, writeFile } from 'node:fs/promises';

import { prepareTemplate } from '@/pptx/automizer';
import { Sample1Service } from '@/services/jszip/Sample1/sample1-service';

import type { PrepareTemplateOptions } from '@/pptx/automizer';

// Step 1 (Prestep): Use pptx-automizer to prepare template by duplicating slide 2
const sourceTemplate = 'templates/template_3.pptx';
const preparedTemplatePath = 'output/automizer/sample1-prepared-template.pptx';

const options: PrepareTemplateOptions = {
  duplicateSlide: 2,
  outputPath: preparedTemplatePath,
};

await mkdir('output/automizer', { recursive: true });
await prepareTemplate(sourceTemplate, options);
console.log(`Prestep completed: Prepared template saved to ${preparedTemplatePath}`);

// Step 2: Use the prepared template file for current manipulation
const service = new Sample1Service(preparedTemplatePath);
const presentationBuffer = await service.generate({
  title: 'Sample 1 Duplicated Slide Report',
  someText: 'Prepared via pptx-automizer prestep and filled with JSZip PresentationService',
});

const outputPath = 'output/automizer/sample1.pptx';
await writeFile(outputPath, presentationBuffer);
console.log(`Presentation generated successfully: ${outputPath}`);
