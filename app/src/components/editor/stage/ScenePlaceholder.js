import React from 'react';

const ScenePlaceholder = ({
  aspectRatio,
  prompt,
  onPromptChange,
  generateDisabled,
  onGenerate,
  isLoading,
  progress,
  fact,
}) => (
  <div
    style={{
      aspectRatio,
      maxWidth: '100%',
      height: '100%',
      borderRadius: '16px',
      overflow: 'hidden',
      objectFit: 'contain',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {!isLoading ? (
      <div style={{
        width: '100%',
        maxWidth: '518px',
        padding: '24px',
        border: '1px solid #000',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'start',
        flexDirection: 'column',
      }}>
        <p style={{ fontSize: 24, marginTop: 0, marginBottom: 20 }}>Scene Visual</p>
        <div style={{ display: 'flex', width: '100%', flexDirection: 'column' }}>
          <p className="labelTop">POSITIVE PROMPT</p>
          <textarea
            value={prompt}
            style={{ width: '100%', fontSize: 14 }}
            onChange={onPromptChange}
            placeholder="Positive Prompt..."
          />
        </div>
        <button
          disabled={generateDisabled}
          onClick={onGenerate}
          style={{
            marginTop: 24,
            cursor: 'pointer',
            border: '1px solid #D9D9D9',
            paddingTop: 8,
            paddingBottom: 8,
            backgroundColor: '#fff',
            color: '#404040',
            fontSize: 16,
            width: '100%',
            borderRadius: '6px',
          }}
        >
          Generate Visuals
        </button>
      </div>
    ) : (
      <div>
        <progress id="progress-bar" max="100" value={progress || null}></progress>
        <p style={{ fontSize: '12px', color: '#404040', marginTop: '8px', textAlign: 'center', margin: '8px auto 0' }}>
          {fact}
        </p>
      </div>
    )}
  </div>
);

export default ScenePlaceholder;
