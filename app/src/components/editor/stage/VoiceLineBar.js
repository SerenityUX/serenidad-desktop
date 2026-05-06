import React from 'react';

export const VOICE_OPTIONS = [
  'Narrator',
  'Male',
  'Male - Deep',
  'Male - Bright',
  'Male - Energetic',
  'Female',
  'Female - Soft',
  'Female - Bright',
  'Female - Energetic',
];

const VoiceLineBar = ({
  voiceText,
  onVoiceTextChange,
  onVoiceTextBlur,
  speakerWav,
  onSpeakerChange,
  compact = false,
}) => (
  <div
    style={{
      width: '100%',
      gap: compact ? 8 : 12,
      display: 'flex',
      flexDirection: compact ? 'column' : 'row',
      justifyContent: 'center',
      maxWidth: '520px',
      paddingTop: compact ? 12 : 24,
      minWidth: 0,
      boxSizing: 'border-box',
    }}
  >
    <input
      value={voiceText}
      onChange={onVoiceTextChange}
      onBlur={onVoiceTextBlur}
      placeholder="Voiceline for this scene..."
      style={{ display: 'flex', flex: 1, minWidth: 0, width: '100%' }}
    />

    <div style={{
      paddingLeft: 0,
      width: compact ? '100%' : 160,
      paddingRight: 8,
      backgroundColor: '#fff',
      border: '1px solid #D9D9D9',
      borderRadius: '8px',
      boxSizing: 'border-box',
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
        {VOICE_OPTIONS.map((voice) => (
          <option key={voice} value={voice}>{voice}</option>
        ))}
      </select>
    </div>
  </div>
);

export default VoiceLineBar;
