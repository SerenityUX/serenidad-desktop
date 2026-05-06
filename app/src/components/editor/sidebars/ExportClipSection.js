import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import Divider from '../shared/Divider';
import { asset } from '../../../lib/asset';
import { space } from '../../../lib/tokens';

const ExportClipSection = ({ canExport, onExport }) => (
  <>
    <Divider />
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <SectionHeader icon={asset('icons/export.svg')} label="Export clip" />
      <button
        type="button"
        onClick={onExport}
        disabled={!canExport}
        className="btn"
        style={{ width: '100%' }}
      >
        Export clip
      </button>
    </div>
  </>
);

export default ExportClipSection;
