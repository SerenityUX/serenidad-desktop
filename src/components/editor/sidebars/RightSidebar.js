import React from 'react';
import CaptionSection from './CaptionSection';
import CaptionStrokeSection from './CaptionStrokeSection';
import ExportClipSection from './ExportClipSection';

const RightSidebar = ({ captionProps, strokeProps, exportProps }) => (
  <div
    id="right-bar"
    style={{
      width: '274px',
      display: 'flex',
      gap: '12px',
      paddingTop: '12px',
      paddingBottom: '16px',
      flexDirection: 'column',
    }}
  >
    <CaptionSection {...captionProps} />
    <CaptionStrokeSection {...strokeProps} />
    <ExportClipSection {...exportProps} />
  </div>
);

export default RightSidebar;
