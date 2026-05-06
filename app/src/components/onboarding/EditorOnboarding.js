import React, { useEffect } from 'react';
import Spotlight from './Spotlight';
import { STEPS, useOnboarding } from '../../context/OnboardingContext';

const TOTAL_STEPS = 6;

/**
 * Editor-side onboarding tips. Listens for backtick (the voice trigger)
 * to advance the final step automatically.
 */
const EditorOnboarding = () => {
  const { step, advanceFrom } = useOnboarding();

  // Final step advances on the first backtick press — once they've tried
  // the voice trigger, we've delivered the lesson.
  useEffect(() => {
    if (step !== STEPS.EDITOR_VOICE) return undefined;
    const onKey = (e) => {
      if (e.key === '`') {
        // Wait until they release so the spotlight doesn't disappear mid-action.
        const onUp = (e2) => {
          if (e2.key === '`') {
            advanceFrom(STEPS.EDITOR_VOICE);
            window.removeEventListener('keyup', onUp);
          }
        };
        window.addEventListener('keyup', onUp);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, advanceFrom]);

  if (step === STEPS.EDITOR_PROMPT) {
    return (
      <Spotlight
        active
        selector='[data-onboard="center-prompt"]'
        title="Describe your first scene"
        body={
          'Type what you want to see in the big prompt box — for example: "a cat astronaut floating above earth, dreamy lighting".'
        }
        placement="top"
        step={4}
        total={TOTAL_STEPS}
        ctaLabel="Next"
        onCta={() => advanceFrom(STEPS.EDITOR_PROMPT)}
      />
    );
  }

  if (step === STEPS.EDITOR_GENERATE) {
    return (
      <Spotlight
        active
        selector='[data-onboard="center-generate"]'
        title="Generate the visual"
        body="Tap the round arrow button to generate. Your result will appear right here in the canvas. Each image costs a small amount of ✻ from your balance."
        placement="left"
        step={5}
        total={TOTAL_STEPS}
        ctaLabel="Next"
        onCta={() => advanceFrom(STEPS.EDITOR_GENERATE)}
      />
    );
  }

  if (step === STEPS.EDITOR_VOICE) {
    return (
      <Spotlight
        active
        centered
        title="Edit with your voice"
        body={
          'Hold the ` (backtick) key and say what to change — e.g. "make her wear a red hat" or "zoom out a bit".\n\nGo ahead and try it now.'
        }
        ctaLabel="Got it"
        onCta={() => advanceFrom(STEPS.EDITOR_VOICE)}
      />
    );
  }

  return null;
};

export default EditorOnboarding;
