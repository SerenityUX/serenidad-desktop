import React, { useEffect, useState } from 'react';
import SectionHeader from '../shared/SectionHeader';
import FieldLabel from '../shared/FieldLabel';
import { asset } from '../../../lib/asset';
import { space } from '../../../lib/tokens';
import { apiUrl } from '../../../config';
import { useAuth } from '../../../context/AuthContext';

/**
 * Single sidebar group for everything style-related: project visual style
 * (appended to all generation prompts) and the per-frame model. Combined
 * here so the sidebar doesn't have a redundant second "Style" header.
 */
const StyleSection = ({
  falModels,
  selectedFalModel,
  onFalModelChange,
  projectId,
  projectStyle,
  onProjectStyleChange,
}) => {
  const { token } = useAuth();
  const [styleOptions, setStyleOptions] = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/projects/styles'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.styles)) setStyleOptions(d.styles);
      })
      .catch(() => {});
  }, [token]);

  const handleStyleChange = async (e) => {
    const next = e.target.value;
    onProjectStyleChange?.(next);
    if (!token || !projectId) return;
    try {
      await fetch(apiUrl(`/projects/${encodeURIComponent(projectId)}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ style: next }),
      });
    } catch {
      // Silent — local state remains; next gen falls back to server value.
    }
  };

  const labels = new Set(styleOptions.map((s) => s.label));
  const mergedStyles =
    !projectStyle || labels.has(projectStyle)
      ? styleOptions
      : [{ id: 'custom', label: projectStyle }, ...styleOptions];

  const showFal = Array.isArray(falModels) && falModels.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <SectionHeader icon={asset('icons/Picture.svg')} label="Style" />

      {projectId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          <FieldLabel>Visual style</FieldLabel>
          <select
            value={projectStyle || ''}
            onChange={handleStyleChange}
            style={{ width: '100%' }}
          >
            {mergedStyles.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showFal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          <FieldLabel>Model</FieldLabel>
          <select
            value={selectedFalModel || ''}
            onChange={onFalModelChange}
            style={{ width: '100%' }}
          >
            {falModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default StyleSection;
