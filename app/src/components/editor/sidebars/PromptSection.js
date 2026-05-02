import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import FieldLabel from '../shared/FieldLabel';

const textareaStyle = (isTransitioning) => ({
  width: 'calc(100% - 32px)',
  marginLeft: 12,
  marginRight: 12,
  resize: 'none',
  padding: '4px 4px',
  border: '1px solid #D9D9D9',
  borderRadius: '4px',
  backgroundColor: '#fff',
  fontSize: '14px',
  color: '#404040',
  height: '60px',
  overflowY: 'auto',
  transition: 'opacity 0.2s ease-in-out',
  opacity: isTransitioning ? 0 : 1,
});

const PromptSection = ({ prompt, onPromptChange, isTransitioning, promptLabel }) => (
  <>
    <SectionHeader icon="icons/Prompt.svg" label={promptLabel === 'VIDEO PROMPT' ? 'Video Prompt' : 'Prompt'} />

    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      <FieldLabel>{promptLabel || 'PROMPT'}</FieldLabel>
      <textarea
        value={prompt}
        onChange={onPromptChange}
        placeholder={promptLabel === 'VIDEO PROMPT' ? 'Describe the motion between the two frames...' : 'Prompt...'}
        style={textareaStyle(isTransitioning)}
      />
    </div>
  </>
);

export default PromptSection;
