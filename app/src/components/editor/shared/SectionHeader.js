import React from 'react';
import Icon from '../../ui/Icon';
import { color, font, space } from '../../../lib/tokens';

const SectionHeader = ({ icon, label }) => (
  <p style={{
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    alignItems: 'center',
    display: 'flex',
    gap: space[2],
    color: color.text,
    margin: 0,
    letterSpacing: '-0.005em',
  }}>
    {icon && <Icon src={icon} size={14} color={color.textMuted} />}
    {label}
  </p>
);

export default SectionHeader;
