import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import Divider from '../shared/Divider';
import { asset } from '../../../lib/asset';

const ExportClipSection = ({ canExport, onExport }) => (
  <>
    <Divider />
    <SectionHeader icon={asset('icons/export.svg')} label="Export Clip" />
    <button
      onClick={onExport}
      disabled={!canExport}
      style={{
        backgroundColor: '#fff',
        color: '#404040',
        border: '1px solid #D9D9D9',
        borderRadius: '6px',
        padding: '8px 12px',
        marginLeft: 12,
        marginRight: 12,
        fontSize: 13.3,
        cursor: canExport ? 'pointer' : 'not-allowed',
        opacity: canExport ? 1 : 0.6,
      }}
    >
      Export Clip
    </button>
  </>
);

export default ExportClipSection;
