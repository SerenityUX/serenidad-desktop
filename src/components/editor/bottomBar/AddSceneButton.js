import React from 'react';
import { Img } from 'react-image';

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
        border: '4px solid #D9D9D9',
        borderRadius: '12px',
        maxHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: isPressed ? 0.7 : 1,
        transform: `scale(${isPressed ? 0.95 : 1})`,
        transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
      }}
    >
      <Img src="./icons/Plus.svg" style={{ width: '32px', height: '32px' }} alt="Add Item" />
    </div>
  </div>
);

export default AddSceneButton;
