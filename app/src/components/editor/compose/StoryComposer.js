import React from 'react';

const StoryComposer = ({
  composeUserInput,
  onComposeInputChange,
  composeSubmitted,
  onSubmit,
  enrichedStory,
  charactersCount,
}) => {
  const panelHeight = charactersCount === 0 ? 'calc(100vh - 46px)' : 'calc(100vh - 306px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'row', widows: '100vw', justifyContent: 'center' }}>
      <div style={{ display: 'flex', height: '100%', width: '50vw', borderLeft: '1px solid #D9D9D9', borderRight: '1px solid #D9D9D9' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
          <textarea
            style={{
              width: '100%',
              fontSize: 16,
              padding: '8px',
              height: panelHeight,
              transition: 'height 0.2s ease-out',
              border: '0px',
              borderRadius: '0px',
              resize: 'none',
              overflowY: 'auto',
              fontFamily: 'system-ui, sans-serif',
            }}
            value={composeUserInput}
            onChange={(e) => onComposeInputChange(e.target.value)}
            placeholder="Compose your story..."
            disabled={composeSubmitted}
          />
          {!composeSubmitted && (
            <button
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                backgroundColor: '#000',
                color: 'white',
                border: 'none',
                fontWeight: 500,
                borderRadius: '4px',
                fontSize: '16px',
                padding: '4px 8px',
                cursor: 'pointer',
                opacity: composeUserInput ? 1 : 0.5,
              }}
              disabled={!composeUserInput}
              onClick={onSubmit}
            >
              Generate Story
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        height: '100%',
        width: composeSubmitted ? '50vw' : '0vw',
        transition: 'width 0.2s ease-out',
        borderLeft: '0px solid #D9D9D9',
        borderRight: '1px solid #D9D9D9',
      }}>
        <div style={{
          position: 'relative',
          width: composeSubmitted ? '100%' : '0',
          transition: 'width 0.2s ease-out',
          height: '100%',
          display: 'flex',
        }}>
          {composeSubmitted && (
            <p style={{
              fontSize: 16,
              width: '100%',
              overflowY: 'scroll',
              height: panelHeight,
              transition: 'height 0.2s ease-out',
              display: 'flex',
              margin: 0,
              padding: 8,
            }}>
              {enrichedStory !== '' ? enrichedStory : 'Enriching Story... '}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryComposer;
