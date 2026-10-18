import type { TemplateSettings } from '../template-settings.ts';

// Configure the authored template here; names are PowerPoint Selection Pane names.
export const templateSettings = {
  tables: {
    x2Tab1: {
      name: 'X2_TAB1',
      slide: 2,
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x2Tab1Dup: {
      name: 'X2_TAB1',
      slide: 3,
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x3Tab1: {
      name: 'X3_TAB1',
      slide: 4,
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x3Tab2: {
      name: 'X3_TAB2',
      slide: 4,
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x4Tab1: {
      name: 'X4_TAB1',
      slide: 5,
      options: {
        startRow: 1,
      },
    },
    x4Tab2: {
      name: 'X4_TAB2',
      slide: 5,
      options: {
        startRow: 1,
      },
    },
  },
  charts: {
    x2Chart1: {
      name: 'X2_CHART1',
      slide: 2,
    },
    x2Chart1Dup: {
      name: 'X2_CHART1',
      slide: 3,
    },
    x3Chart1: {
      name: 'X3_CHART1',
      slide: 4,
    },
    x3Chart2: {
      name: 'X3_CHART2',
      slide: 4,
    },
  },
  texts: {
    x1Title: {
      name: 'X1_TITLE',
      slide: 1,
    },
    x1Sub: {
      name: 'X1_SUB',
      slide: 1,
      options: {
        replace: '{{ASOF}}',
      },
    },
    x1Text: {
      name: 'X1_TEXT',
      slide: 1,
    },
    x2Title: {
      name: 'X2_TITLE',
      slide: 2,
    },
    x2TitleDup: {
      name: 'X2_TITLE',
      slide: 3,
    },
    x3Title: {
      name: 'X3_TITLE',
      slide: 4,
    },
    x4Title: {
      name: 'X4_TITLE',
      slide: 5,
    },
  },
} satisfies TemplateSettings;
