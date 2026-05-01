import React from 'react';
import TitleBar from './TitleBar';
import StoryComposer from './compose/StoryComposer';
import CharactersStrip from './compose/CharactersStrip';

const ComposeLayout = ({
  storyboardMode,
  composeUserInput,
  onComposeInputChange,
  composeSubmitted,
  onSubmitStory,
  enrichedStory,
  characters,
  composeComplete,
  onGenerateStoryboard,
}) => (
  <div style={{
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Arial, sans-serif',
    margin: 0,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <TitleBar showExport={false} />

    {storyboardMode ? (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: 'calc(100vh - 46px)',
      }}>
        <p>Storyboard Mode</p>
      </div>
    ) : (
      <>
        <StoryComposer
          composeUserInput={composeUserInput}
          onComposeInputChange={onComposeInputChange}
          composeSubmitted={composeSubmitted}
          onSubmit={onSubmitStory}
          enrichedStory={enrichedStory}
          charactersCount={characters.length}
        />
        <CharactersStrip
          characters={characters}
          composeComplete={composeComplete}
          composeUserInput={composeUserInput}
          onGenerateStoryboard={onGenerateStoryboard}
        />
      </>
    )}
  </div>
);

export default ComposeLayout;
