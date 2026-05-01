import React from 'react';
import { Img } from 'react-image';

const SectionHeader = ({ icon, label }) => (
  <p style={{
    fontSize: 16,
    alignItems: 'center',
    display: 'flex',
    gap: '8px',
    color: '#404040',
    marginTop: 0,
    marginLeft: 12,
    marginBottom: 0,
  }}>
    {icon && <Img src={icon} />}
    {label}
  </p>
);

export default SectionHeader;
