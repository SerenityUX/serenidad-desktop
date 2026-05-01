import React from 'react';

const FieldLabel = ({ children }) => (
  <p style={{
    color: '#404040',
    fontWeight: 800,
    marginTop: 0,
    marginBottom: 0,
    fontSize: 6,
    marginLeft: 12,
    marginRight: 12,
  }}>
    {children}
  </p>
);

export default FieldLabel;
