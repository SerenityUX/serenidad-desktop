import React from 'react';

const CharacterCard = ({ character }) => (
  <div style={{ width: 130, borderRadius: 4, height: 185, border: '1px solid #000', padding: 8 }}>
    <p style={{
      margin: 0,
      fontSize: 10,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {character.name}
    </p>
    <div style={{
      width: 'calc(100% - 10px)',
      display: 'flex',
      border: '1px solid #000',
      borderRadius: 2,
      padding: 4,
    }}>
      <p style={{ margin: 0, fontSize: 10, overflowY: 'scroll', height: 74, width: '100%' }}>
        {character.visualDescription}
      </p>
    </div>
    <p style={{ margin: 0, fontSize: 10, height: 98, overflowY: 'scroll', width: '100%' }}>
      {character.plotDescription}
    </p>
  </div>
);

export default CharacterCard;
