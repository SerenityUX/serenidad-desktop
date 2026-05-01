import React from 'react';
import CharacterCard from './CharacterCard';

const CharactersStrip = ({ characters, composeComplete, composeUserInput, onGenerateStoryboard }) => {
  if (characters.length === 0) return null;
  return (
    <div style={{
      height: '259px',
      transition: 'height 0.2s ease-out',
      padding: 16,
      gap: 8,
      display: 'flex',
      flexDirection: 'row',
      width: 'calc(100vw - 32px)',
      borderTop: '1px solid #D9D9D9',
    }}>
      {characters.map((character, idx) => (
        <CharacterCard key={`${character.name}-${idx}`} character={character} />
      ))}
      {composeComplete && (
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
          onClick={onGenerateStoryboard}
        >
          Generate Storyboard
        </button>
      )}
    </div>
  );
};

export default CharactersStrip;
