import React from 'react';
import { color, font } from '../../../lib/tokens';

const FieldLabel = ({ children }) => (
  <p style={{
    color: color.textMuted,
    fontWeight: font.weight.medium,
    margin: 0,
    fontSize: font.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  }}>
    {children}
  </p>
);

export default FieldLabel;
