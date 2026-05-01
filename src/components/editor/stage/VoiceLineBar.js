import React from 'react';

const VoiceLineBar = ({
  voiceText,
  onVoiceTextChange,
  speakerWav,
  voices,
  onSpeakerChange,
  onGenerateVoice,
  isGeneratingVoice,
  generateText,
}) => (
  <div style={{ width: '100%', gap: 16, display: 'flex', flexDirection: 'row', maxWidth: '700px', paddingTop: 24 }}>
    <input
      value={voiceText}
      onChange={onVoiceTextChange}
      placeholder="Voiceline for this scene..."
      style={{ display: 'flex', width: '100%' }}
    />

    <div style={{
      paddingLeft: 0,
      width: 128,
      paddingRight: 8,
      backgroundColor: '#fff',
      border: '1px solid #D9D9D9',
      borderRadius: '8px',
    }}>
      <select
        value={speakerWav}
        onChange={onSpeakerChange}
        style={{
          paddingLeft: 8,
          height: '100%',
          width: '100%',
          paddingRight: 0,
          border: '0px solid #D9D9D9',
          borderRadius: '8px',
        }}
        name="voice"
        id="voice-select"
      >
        {voices.map((voice) => (
          <option key={voice} value={voice}>{voice}</option>
        ))}
        <option value="add-voice">Add Voice...</option>
      </select>
    </div>

    <button
      onClick={onGenerateVoice}
      disabled={isGeneratingVoice}
      style={{
        border: '1px solid #D9D9D9',
        width: '196px',
        borderRadius: '8px',
        backgroundColor: '#fff',
        padding: '12px 8px',
        fontSize: 13.3,
        cursor: isGeneratingVoice ? 'not-allowed' : 'pointer',
        opacity: isGeneratingVoice ? 0.6 : 1,
      }}
    >
      {generateText}
    </button>
  </div>
);

export default VoiceLineBar;
