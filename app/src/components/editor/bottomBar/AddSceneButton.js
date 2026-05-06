import React from 'react';
import { asset } from '../../../lib/asset';
import Icon from '../../ui/Icon';

const AddSceneButton = ({ aspectRatio, isPressed, onMouseDown, onMouseUp, onMouseLeave }) => (
  <div
    id="addItem"
    style={{
      display: 'flex',
      width: 'fit-content',
      maxHeight: '100%',
      padding: '24px',
      marginLeft: '24px',
      paddingLeft: '0px',
      paddingRight: '0px',
      marginRight: '0px',
      cursor: 'pointer',
      transform: `scale(${isPressed ? 0.9 : 1})`,
      transition: 'transform 0.1s ease-out',
    }}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseLeave}
  >
    <div
      style={{
        aspectRatio,
        border: '2px dashed rgba(255,255,255,0.25)',
        borderRadius: '12px',
        maxHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'rgba(255,255,255,0.6)',
        opacity: isPressed ? 0.7 : 1,
        transform: `scale(${isPressed ? 0.95 : 1})`,
        transition: 'opacity 0.1s ease-out, transform 0.1s ease-out, border-color 120ms ease',
      }}
    >
      <Icon src={asset('icons/Plus.svg')} size={28} title="Add scene" />
    </div>
  </div>
);

export default AddSceneButton;
