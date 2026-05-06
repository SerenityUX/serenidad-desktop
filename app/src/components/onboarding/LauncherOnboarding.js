import React from 'react';
import Spotlight from './Spotlight';
import { STEPS, useOnboarding } from '../../context/OnboardingContext';

/**
 * Launcher-side overlay. Drives the welcome card, the "click Create" tip,
 * and the "fill name" tip. Editor steps live in EditorOnboarding so they
 * can attach to elements that don't exist on the launcher route.
 */
const TOTAL_STEPS = 6;

const LauncherOnboarding = () => {
  const { step, advanceFrom, skip } = useOnboarding();

  if (step === STEPS.WELCOME) {
    return (
      <Spotlight
        active
        centered
        title="Welcome to CoCreate"
        body={
          'Make your first story in a few minutes.\n\nWe\'ve dropped ✻100 (about $1) into your account so you can try it out — enough to generate a few images and play with the voice tools.'
        }
        ctaLabel="Show me how"
        onCta={() => advanceFrom(STEPS.WELCOME)}
        onSkip={skip}
      />
    );
  }

  if (step === STEPS.CLICK_CREATE) {
    return (
      <Spotlight
        active
        selector='[data-onboard="create-button"]'
        title="Start your first story"
        body="Click Create to spin up a new project. You can give it any name — we'll set sensible defaults for you."
        placement="bottom"
        step={2}
        total={TOTAL_STEPS}
        onSkip={skip}
      />
    );
  }

  if (step === STEPS.FILL_NAME) {
    return (
      <Spotlight
        active
        selector='[data-onboard="project-name-input"]'
        title="Name your story"
        body={
          "Type any title and hit Create Project. The size defaults to 1280×720 — you can change it later."
        }
        placement="right"
        step={3}
        total={TOTAL_STEPS}
        onSkip={skip}
      />
    );
  }

  return null;
};

export default LauncherOnboarding;
