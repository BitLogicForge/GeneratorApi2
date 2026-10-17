# Small JSZip examples

Run commands from the repository root. Each example changes one part of a template
and saves a new editable PPTX under `output/jszip/`. Start with **text**.

| Example                                  | Run                                    | What it demonstrates                                                                                                         |
| ---------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [text.ts](text.ts)                       | `npm run example:pptx:text`            | Change `TEXT_ME` text.                                                                                                       |
| [paragraphs.ts](paragraphs.ts)           | `npm run example:pptx:paragraphs`      | Fill paragraphs and replace repeated text.                                                                                   |
| [chart.ts](chart.ts)                     | `npm run example:pptx:chart`           | Fill the three-series `GGO` chart with two categories.                                                                       |
| [table.ts](table.ts)                     | `npm run example:pptx:table`           | Keep the `TAB100` header and resize both rows and columns (2D resizing).                                                     |
| [placeholders.ts](placeholders.ts)       | `npm run example:pptx:placeholders`    | Fill `{{key}}` tokens across slides and notes using `replacePlaceholders` and `template.json`.                               |
| [duplicate-slide.ts](duplicate-slide.ts) | `npm run example:pptx:duplicate-slide` | Copy a slide with independent chart data.                                                                                    |
| [remove-slide.ts](remove-slide.ts)       | `npm run example:pptx:remove-slide`    | Remove the first slide from the duplication example's output. Run duplication first: the source template has only one slide. |

After these, [workflow.ts](workflow.ts) combines duplicate → fill chart/table/text →
remove original. Run it with `npm run example:fill-template`; its output remains
`output/filled-template.pptx`.

The examples use the names authored in `templates/daa.pptx` (or `templates/business.pptx` for token placeholders) and never overwrite them.
They use JSZip and XML saving directly so every required step is visible.
See [the utility reference](../../../src/pptx/jszip/README.md) for all functions,
options, save behavior and limitations. Run `npm run test:jszip` to verify them.
