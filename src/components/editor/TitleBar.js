import React from 'react';

const TrafficLight = ({ color, action }) => (
  <div
    onClick={() => window.electron.ipcRenderer.invoke(action)}
    style={{
      backgroundColor: color,
      width: 14,
      height: 14,
      borderRadius: 7,
      cursor: 'pointer',
      WebkitAppRegion: 'no-drag',
    }}
  />
);

const TitleBar = ({ onExport, showExport = true }) => (
  <div style={{
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 45,
    backgroundColor: '#fff',
    borderBottom: '1px solid #D9D9D9',
    WebkitAppRegion: 'drag',
  }}>
    <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'row', gap: 9 }}>
      <TrafficLight color="#FE5F58" action="close-app" />
      <TrafficLight color="#FEBC2F" action="minimize-app" />
      <TrafficLight color="#28C840" action="maximize-app" />
    </div>

    <p style={{ fontWeight: 500, WebkitAppRegion: 'drag' }}>Kōdan</p>

    <div>
      {showExport && (
        <button
          onClick={onExport}
          style={{
            backgroundColor: '#1F93FF',
            color: '#fff',
            paddingLeft: 8,
            paddingRight: 8,
            border: '0px',
            borderRadius: 4,
            marginRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
            WebkitAppRegion: 'no-drag',
          }}
        >
          Export
        </button>
      )}
    </div>
  </div>
);

export default TitleBar;
