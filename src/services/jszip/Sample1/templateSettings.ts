import type { TemplateSettings } from '../template-settings';

// Configure the authored template here; names are PowerPoint Selection Pane names.
export const templateSettings = {
  tables: {
    x2Tab1: {
      name: 'X2_TAB1',
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x3Tab1: {
      name: 'X3_TAB1',
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x3Tab2: {
      name: 'X3_TAB2',
      options: {
        startRow: 1,
        resizeRows: true,
      },
    },
    x4Tab1: {
      name: 'X4_TAB1',
      options: {
        startRow: 1,
      },
    },
    x4Tab2: {
      name: 'X4_TAB2',
      options: {
        startRow: 1,
      },
    },
  },
  charts: {
    x2Chart1: {
      name: 'X2_CHART1',
    },
    x3Chart1: {
      name: 'X3_CHART1',
    },
    x3Chart2: {
      name: 'X3_CHART2',
    },
  },
  texts: {
    x1Title: {
      name: 'X1_TITLE',
    },
    x1Sub: {
      name: 'X1_SUB',
      options: {
        replace: '{{ASOF}}',
      },
    },
    x1Text: {
      name: 'X1_TEXT',
    },
    x2Title: {
      name: 'X2_TITLE',
    },
    x3Title: {
      name: 'X3_TITLE',
    },
    x4Title: {
      name: 'X4_TITLE',
    },
  },
} satisfies TemplateSettings;
