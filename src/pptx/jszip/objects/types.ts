export interface ObjectBoundsEmu {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export interface MoveObjectOptions {
  /** Absolute horizontal position from the left edge of the slide in centimeters (cm). */
  x?: number;
  /** Absolute vertical position from the top edge of the slide in centimeters (cm). */
  y?: number;
  /** Relative horizontal offset in centimeters (cm) added to the horizontal position. */
  dx?: number;
  /** Relative vertical offset in centimeters (cm) added to the vertical position. */
  dy?: number;
}

export interface ResizeObjectOptions {
  /** Absolute width in centimeters (cm). */
  width?: number;
  /** Absolute height in centimeters (cm). */
  height?: number;
  /** Relative width delta in centimeters (cm) added to the width. */
  dWidth?: number;
  /** Relative height delta in centimeters (cm) added to the height. */
  dHeight?: number;
}
