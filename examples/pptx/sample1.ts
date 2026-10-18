import { mkdir, writeFile } from 'node:fs/promises';

import { prepareTemplate } from '@/pptx/automizer';
import { templateFile } from '@/reports/template';
import { Sample1Service } from '@/services/jszip/Sample1/sample1-service';

// Step 1: Pre-step - Use pptx-automizer to prepare the template by duplicating slide 2
const preparedTemplate = await prepareTemplate(templateFile('template_3.pptx'), {
  duplicateSlide: 2,
  outputPath: 'output/automizer/sample1-prepared-template.pptx',
});

// Step 2: Use this prepared template for current manipulation (JSZip presentation service)
const service = new Sample1Service(preparedTemplate);
const result = await service.generate({
  title: 'Sample 1 - Duplicated Slide Demo',
  someText: 'Slide 2 was duplicated and populated with a second timeseries data set',
});

await mkdir('output/automizer', { recursive: true });
await writeFile('output/automizer/sample1.pptx', result);
console.log('Sample 1 presentation generated successfully: output/automizer/sample1.pptx');
