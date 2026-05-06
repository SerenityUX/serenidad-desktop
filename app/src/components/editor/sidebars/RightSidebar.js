import React from 'react';
import CaptionSection from './CaptionSection';
import CaptionStrokeSection from './CaptionStrokeSection';
import DurationSection from './DurationSection';
import ExportClipSection from './ExportClipSection';
import { color, space } from '../../../lib/tokens';

const RightSidebar = ({ captionProps, strokeProps, durationProps, exportProps }) => (
  <div
    id="right-bar"
    style={{
      width: 274,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: color.bgSubtle,
      borderLeft: `1px solid ${color.border}`,
      paddingTop: space[4],
      paddingBottom: space[4],
      paddingLeft: space[3],
      paddingRight: space[3],
      gap: space[4],
      overflowY: 'auto',
    }}
  >
    <CaptionSection {...captionProps} />
    <CaptionStrokeSection {...strokeProps} />
    {durationProps ? <DurationSection {...durationProps} /> : null}
    <ExportClipSection {...exportProps} />
  </div>
);

export default RightSidebar;
