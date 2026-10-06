'use client';

import { useEffect, useState } from 'react';

import DotField from './DotField';

export default function QuestifyDotBackground() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setDark(root.dataset.theme === 'dark');
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="questify-dot-background" aria-hidden="true">
      <DotField
        className="questify-dot-field"
        dotRadius={5}
        dotSpacing={15}
        bulgeStrength={38}
        glowRadius={0}
        sparkle={false}
        waveAmplitude={0}
        cursorRadius={320}
        cursorForce={0.1}
        bulgeOnly
        gradientFrom={dark ? 'rgba(79, 113, 93, 0.22)' : 'rgba(164, 249, 212, 0.2)'}
        gradientTo={dark ? 'rgba(227, 166, 110, 0.12)' : 'rgba(194, 118, 66, 0.1)'}
        glowColor={dark ? 'rgba(38, 58, 46, 0.9)' : 'rgba(228, 239, 233, 0.82)'}
      />
    </div>
  );
}
