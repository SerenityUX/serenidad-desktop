import React, { useEffect, useState, useCallback, useRef } from 'react';
import { debounce } from 'lodash';

import animeFacts from '../../data/animeFacts.json';
import { apiUrl } from '../../config';
import EditorLayout from './EditorLayout';
import { VOICE_OPTIONS } from './stage/VoiceLineBar';
import ShareModal from './ShareModal';
import ProjectLoadingSkeleton from './ProjectLoadingSkeleton';
import StoryboardView from './storyboard/StoryboardView';
import { composeSceneToPng } from '../../lib/composeScene';
import { encodeSegmentsToMp4 } from '../../lib/exportProject';
import useVoicePrompt from '../../hooks/useVoicePrompt';
import platform from '../../platform';

const DEFAULT_IMAGE_DURATION = 2;
const DEFAULT_VIDEO_DURATION = 4;

const REMOTE_CAPTION_DEFAULT = {
  fontSize: 16,
  captionColor: '#FFE600',
  caption: '',
  strokeColor: '#000000',
  strokeSize: 1.5,
  selectedFont: 'Arial',
  selectedWeight: '700',
};

/** Maps GET /projects/:id + frames rows into the legacy scene-shaped structure the editor expects. */
function remoteDetailToProjectData(projectRow, frames) {
  return {
    name: projectRow.name,
    scenes: (frames || []).map((f) => {
      const meta = f.meta && typeof f.meta === 'object' ? f.meta : {};
      const kind = meta.kind === 'video' ? 'video' : 'image';
      const rawDuration = Number(meta.durationSeconds);
      const durationSeconds = rawDuration > 0
        ? rawDuration
        : (kind === 'video' ? DEFAULT_VIDEO_DURATION : DEFAULT_IMAGE_DURATION);
      return {
        frameId: f.id,
        id: f.id,
        thumbnail: f.result || '',
        positivePrompt: f.prompt || '',
        references: Array.isArray(f.reference_urls) ? f.reference_urls : [],
        model: f.model || '',
        voiceline: meta.voiceline || '',
        speaker: meta.speaker || 'Narrator',
        baseModel: meta.baseModel || '',
        selectedLora: meta.selectedLora || '',
        kind,
        durationSeconds,
        captionSettings: {
          ...REMOTE_CAPTION_DEFAULT,
          ...(meta.captionSettings || {}),
        },
      };
    }),
  };
}

const weightToLabel = (weight) => {
  const map = {
    100: 'Thin',
    200: 'Extra Light',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'Semi Bold',
    700: 'Bold',
    800: 'Extra Bold',
    900: 'Black',
  };
  return map[weight] || weight.toString();
};

const ProjectComponent = ({ projectId }) => {
  // Cloud-only mode. The launcher bails before mount if no projectId.
  const isRemote = true;

  // Project data + selection
  const [projectData, setProjectData] = useState(null);
  const [thumbnail, setThumbnail] = useState('');
  const [aspectRatio, setAspectRatio] = useState(1);
  /* Stable, project-wide aspect — never overwritten by individual image loads, so
     scene-strip tiles don't reflow when generated images come back at slightly
     different dimensions (e.g. nano-banana edit may return a square). */
  const [projectAspectRatio, setProjectAspectRatio] = useState(16 / 9);
  const [selectedScene, setSelectedScene] = useState(1);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  const [videoKey, setVideoKey] = useState(null);

  // Voice
  const [voiceText, setVoiceText] = useState('');
  const [speakerWav, setSpeakerWav] = useState('Narrator');

  // Prompt: NOT held as duplicated top-level state. We read directly from
  // projectData.scenes[selectedScene-1].positivePrompt below, and write into
  // the scene by frameId on every keystroke. This removes a whole class of
  // bugs where a *different* scene's generation completing (and refetching
  // projectData) would clobber the textarea while the user was typing.
  const [promptFocusToken, setPromptFocusToken] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fal models + per-scene picks
  const [falModels, setFalModels] = useState([]);
  const [defaultFalModelId, setDefaultFalModelId] = useState('fal-ai/nano-banana-2');
  const [selectedFalModel, setSelectedFalModel] = useState('fal-ai/nano-banana-2');
  const [falVideoModels, setFalVideoModels] = useState([]);
  const [defaultFalVideoModelId, setDefaultFalVideoModelId] = useState('alibaba/happy-horse/reference-to-video');
  // Used by the single-frame "Convert to Video" button — image-to-video, not
  // reference-to-video, so a single image animates instead of being treated
  // as one of many conditioning refs.
  const [defaultImageToVideoModelId, setDefaultImageToVideoModelId] = useState('alibaba/happy-horse/image-to-video');

  // Multi-select for "Make Video Frame" — array of scene numbers (1-based)
  // that are *additionally* selected via shift-click; the primary
  // `selectedScene` is always also part of the visual multi-selection.
  const [multiSelectedScenes, setMultiSelectedScenes] = useState([]);

  // Per-scene duration input (hydrated when selectedScene changes). Used for
  // both image (hold time) and video (generation/playback) frames.
  const [sceneDuration, setSceneDuration] = useState(DEFAULT_IMAGE_DURATION);
  // Frames currently mid-video-generation, keyed by stable frameId. Keying by
  // frameId (rather than scene index) means inserting/removing/reordering
  // frames mid-flight can't accidentally smear the loading state onto a
  // different frame. Surfaced to the storyboard for in-progress indicators.
  const [creatingVideoFrameIds, setCreatingVideoFrameIds] = useState(() => new Set());
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [videoStatusMessage, setVideoStatusMessage] = useState('');

  // References
  const [references, setReferences] = useState([]);
  const [referencesUploading, setReferencesUploading] = useState(false);

  // Image selection (for cmd+c / cmd+v on the generated visual)
  const [imageSelected, setImageSelected] = useState(false);

  // Sequential playback across scenes (image holds for durationSeconds; video
  // plays to its natural end and fires onEnded to advance).
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef(null);

  // Generation: image-generation in-flight, keyed by stable frameId. Same
  // reasoning as creatingVideoFrameIds — index-keyed loading state was
  // bleeding across frames when new ones were inserted.
  const [loadingFrameIds, setLoadingFrameIds] = useState(() => new Set());
  const [progressMap, setProgressMap] = useState({});
  const [progressMessageMap, setProgressMessageMap] = useState({});
  // Per-frame button label override during generation (e.g. "Generating");
  // keyed by frameId.
  const [generateImageText, setGenerateImageText] = useState({});
  const [currentFact, setCurrentFact] = useState('');

  // Caption
  const [captionSettings, setCaptionSettings] = useState({
    fontSize: 16,
    captionColor: '#FFE600',
    caption: '',
    strokeColor: '#000000',
    strokeSize: 1.5,
    selectedFont: 'Arial',
    selectedWeight: '700',
  });
  const [localCaption, setLocalCaption] = useState('');
  const [availableFonts, setAvailableFonts] = useState([]);
  const [availableWeights, setAvailableWeights] = useState([]);

  // Scene strip interaction
  const [pressedScene, setPressedScene] = useState(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [pressedAddScene, setPressedAddScene] = useState(false);
  const [deletingScenes, setDeletingScenes] = useState(new Set());
  const sceneRefs = useRef({});

  // Export
  const [canExportClip, setCanExportClip] = useState(false);

  // Share
  const [shareOpen, setShareOpen] = useState(false);

  const [authToken, setAuthToken] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);

  const patchFrame = useCallback(
    async (frameId, body) => {
      if (!authToken || !projectId || !frameId) return;
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}`,
        ),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || res.statusText || 'Request failed');
      }
    },
    [authToken, projectId],
  );

  const refetchRemoteProject = useCallback(async () => {
    if (!authToken || !projectId) return null;
    const res = await fetch(apiUrl(`/projects/${encodeURIComponent(projectId)}`), {
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(data.error || res.status);
      return null;
    }
    const pd = remoteDetailToProjectData(data.project, data.frames || []);
    setProjectData(pd);
    return pd;
  }, [authToken, projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await platform.getEditorAuthToken();
        if (!cancelled) {
          setAuthToken(t || null);
          setAuthResolved(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setAuthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRemote || !projectId || !authToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/projects/${encodeURIComponent(projectId)}`), {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json',
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) {
          console.error(data.error || res.status);
          return;
        }
        const pd = remoteDetailToProjectData(data.project, data.frames || []);
        setProjectData(pd);
        const pw = data.project.width || 1280;
        const ph = data.project.height || 720;
        setImgW(pw);
        setImgH(ph);
        setAspectRatio(pw / ph);
        setProjectAspectRatio(pw / ph);
        if (pd.scenes.length > 0) {
          const s = pd.scenes[0];
          if (s.thumbnail) loadThumbnail(s.thumbnail);
          else setThumbnail('');
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRemote, projectId, authToken]);

  const copyImageToClipboard = useCallback(async (url) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch (e) {
      console.warn('clipboard writeText failed', e);
    }
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        const res = await fetch(url);
        const blob = await res.blob();
        const type = blob.type && /^image\//.test(blob.type) ? blob.type : 'image/png';
        const item = new window.ClipboardItem({ [type]: blob });
        await navigator.clipboard.write([item]);
      }
    } catch (e) {
      console.warn('clipboard image write skipped:', e?.message || e);
    }
  }, []);

  const pasteFromClipboardToReferences = useCallback(async () => {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = (item.types || []).find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const ext = imageType.split('/')[1] || 'png';
            const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: imageType });
            await handleAddReferenceFiles([file]);
            return;
          }
        }
      }
    } catch {
      /* fall through to text */
    }
    try {
      const text = (await navigator.clipboard.readText())?.trim();
      if (text && /^https?:\/\//i.test(text)) {
        await handleAddReferenceUrl(text);
      }
    } catch (e) {
      console.warn('clipboard readText failed', e);
    }
  }, [handleAddReferenceFiles, handleAddReferenceUrl]);

  const reorderFrames = useCallback(
    async (newOrderIds) => {
      if (!authToken || !projectId) return;
      const res = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectId)}/frame-order`),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ frame_ids: newOrderIds }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Reorder failed');
      }
    },
    [authToken, projectId],
  );

  const applyReorderLocal = useCallback(
    (newOrderIds) => {
      setProjectData((prev) => {
        if (!prev) return prev;
        const byId = new Map(prev.scenes.map((s) => [s.frameId, s]));
        const reordered = newOrderIds
          .map((id) => byId.get(id))
          .filter(Boolean);
        return { ...prev, scenes: reordered };
      });
    },
    [],
  );

  const handleReorderFrames = useCallback(
    async (newOrderIds) => {
      if (!projectData) return;
      const prevSelectedFrameId =
        projectData.scenes[selectedScene - 1]?.frameId;
      applyReorderLocal(newOrderIds);
      if (prevSelectedFrameId) {
        const newIdx = newOrderIds.indexOf(prevSelectedFrameId);
        if (newIdx >= 0) setSelectedScene(newIdx + 1);
      }
      try {
        await reorderFrames(newOrderIds);
      } catch (e) {
        console.error(e);
        window.alert(e.message || 'Could not save new order');
        await refetchRemoteProject();
      }
    },
    [projectData, selectedScene, applyReorderLocal, reorderFrames, refetchRemoteProject],
  );

  const duplicateAsEditFrame = useCallback(async () => {
    if (!isRemote || !authToken || !projectId || !projectData) return;
    const sourceScene = projectData.scenes[selectedScene - 1];
    const sourceUrl = sourceScene?.thumbnail;
    if (!sourceUrl) {
      window.alert('No image on this frame to duplicate yet — generate one first.');
      return;
    }
    try {
      const addRes = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectId)}/frames`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json',
          },
        },
      );
      const addBody = await addRes.json().catch(() => ({}));
      if (!addRes.ok) throw new Error(addBody.error || 'Add frame failed');
      const newFrameId = addBody.frame?.id;
      if (!newFrameId) throw new Error('Server did not return a frame id');

      await patchFrame(newFrameId, {
        model: 'fal-ai/nano-banana/edit',
        reference_urls: [sourceUrl],
      });

      // Insert the new frame right after the source frame in the order.
      const currentIds = projectData.scenes.map((s) => s.frameId);
      const sourceIdx = currentIds.indexOf(sourceScene.frameId);
      const newOrder = currentIds.slice();
      const insertAt = sourceIdx >= 0 ? sourceIdx + 1 : currentIds.length;
      newOrder.splice(insertAt, 0, newFrameId);

      // Optimistic local update so the new tile pops in next-in-line immediately.
      setProjectData((prev) => {
        if (!prev) return prev;
        const placeholderScene = {
          frameId: newFrameId,
          id: newFrameId,
          thumbnail: '',
          positivePrompt: '',
          references: [sourceUrl],
          model: 'fal-ai/nano-banana/edit',
          voiceline: '',
          speaker: 'Narrator',
          baseModel: '',
          selectedLora: '',
          captionSettings: { ...REMOTE_CAPTION_DEFAULT },
        };
        const nextScenes = prev.scenes.slice();
        nextScenes.splice(insertAt, 0, placeholderScene);
        return { ...prev, scenes: nextScenes };
      });
      setVoiceText('');
      setSelectedScene(insertAt + 1);
      setPromptFocusToken((t) => t + 1);

      try {
        await reorderFrames(newOrder);
      } catch (e) {
        console.error('Reorder after duplicate failed:', e);
      }
      // Refetch in the background to reconcile any server-side fields.
      refetchRemoteProject().catch(() => {});
    } catch (e) {
      console.error(e);
      window.alert(e.message || 'Could not duplicate frame');
    }
  }, [isRemote, authToken, projectId, projectData, selectedScene, patchFrame, refetchRemoteProject, reorderFrames]);

  // ---------- Keyboard: scene navigation + image clipboard ops ----------
  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
      const mod = event.metaKey || event.ctrlKey;

      if (event.key === 'Escape' && imageSelected) {
        setImageSelected(false);
        return;
      }

      if (mod && !isInputFocused && (event.key === 'c' || event.key === 'C')) {
        const scene = projectData?.scenes?.[selectedScene - 1];
        if (imageSelected && scene?.thumbnail) {
          event.preventDefault();
          copyImageToClipboard(scene.thumbnail);
        }
        return;
      }

      if (mod && !isInputFocused && (event.key === 'v' || event.key === 'V')) {
        event.preventDefault();
        pasteFromClipboardToReferences();
        return;
      }

      if (mod && !isInputFocused && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        duplicateAsEditFrame();
        return;
      }

      if (
        (event.key === 'Backspace' || event.key === 'Delete') &&
        !isInputFocused &&
        multiSelectedScenes.length >= 1
      ) {
        event.preventDefault();
        const all = Array.from(
          new Set([selectedScene, ...multiSelectedScenes]),
        ).sort((a, b) => a - b);
        const ok = window.confirm(
          `Delete ${all.length} selected frame${all.length === 1 ? '' : 's'}?`,
        );
        if (ok) deleteScenesBulk(all);
        return;
      }

      if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !isInputFocused) {
        setVoiceText('');
        setMultiSelectedScenes([]);
        setPressedScene(selectedScene);
        setTimeout(() => {
          setSelectedScene((prevScene) => {
            if (event.key === 'ArrowRight' && projectData && prevScene < projectData.scenes.length) return prevScene + 1;
            if (event.key === 'ArrowLeft' && prevScene > 1) return prevScene - 1;
            return prevScene;
          });
          setPressedScene(null);
        }, 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    projectData,
    selectedScene,
    imageSelected,
    copyImageToClipboard,
    pasteFromClipboardToReferences,
    duplicateAsEditFrame,
    multiSelectedScenes,
  ]);

  // Click anywhere outside the selected image clears the selection.
  useEffect(() => {
    if (!imageSelected) return undefined;
    const handleDocClick = () => setImageSelected(false);
    window.addEventListener('mousedown', handleDocClick);
    return () => window.removeEventListener('mousedown', handleDocClick);
  }, [imageSelected]);

  // Selecting a different scene drops any prior image selection.
  useEffect(() => {
    setImageSelected(false);
  }, [selectedScene]);

  // ---------- Remote frames: show image/video URL from SQL `frames.result` ----------
  useEffect(() => {
    if (!isRemote || !projectData?.scenes?.length) return;
    const scene = projectData.scenes[selectedScene - 1];
    if (scene?.thumbnail) {
      loadThumbnail(scene.thumbnail);
    } else {
      setThumbnail('');
    }
    setVideoKey(null);
  }, [isRemote, selectedScene, projectData]);

  const loadThumbnail = (thumbnailPath) =>
    new Promise((resolve) => {
      const path = String(thumbnailPath || '');
      // Video URLs can't preload through `new Image()` — `onerror` would clear
      // the thumbnail, hiding successful video generations. Set them directly.
      if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(path)) {
        setThumbnail(path);
        setVideoKey(Date.now());
        resolve(true);
        return;
      }
      const img = new Image();
      img.src = path;
      img.onload = () => {
        setThumbnail(path);
        setAspectRatio(img.width / img.height);
        setImgW(img.width);
        setImgH(img.height);
        resolve(true);
      };
      img.onerror = () => {
        setThumbnail(null);
        console.error('Error loading thumbnail image.');
        resolve(false);
      };
    });

  // ---------- Image generation ----------
  // Takes a frameId so the request is bound to a stable identity, not to a
  // scene-index that may shift if frames are added/removed/reordered while
  // the request is in flight.
  const generateImage = async (frameId) => {
    if (!frameId || !authToken || !projectId) return;
    const scene = projectData?.scenes?.find((s) => s.frameId === frameId);
    const promptText = String(scene?.positivePrompt || '').trim();
    const clearLoading = () => {
      setLoadingFrameIds((prev) => {
        if (!prev.has(frameId)) return prev;
        const next = new Set(prev);
        next.delete(frameId);
        return next;
      });
      setGenerateImageText((prev) => {
        if (!(frameId in prev)) return prev;
        const next = { ...prev };
        delete next[frameId];
        return next;
      });
    };
    if (!promptText) {
      window.alert('Enter a prompt first.');
      clearLoading();
      return;
    }
    try {
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}/generate-image`,
        ),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ prompt: promptText, model: selectedFalModel }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const required = body.required ?? body.tokenCost;
        const msg =
          body.error ||
          (res.status === 402
            ? `Not enough tokens (need ${required ?? '?'}; you have ${body.tokens ?? '?'})`
            : `Generation failed (${res.status})`);
        throw new Error(msg);
      }
      const pd = await refetchRemoteProject();
      const sceneAfter = pd?.scenes?.find((s) => s.frameId === frameId);
      const thumb = body.frame?.result || sceneAfter?.thumbnail;
      // Only wait for the freshly generated bytes if the user is still
      // looking at the same frame — otherwise we'd block the loading-state
      // clear behind a thumbnail load they don't even see.
      const stillOnFrame =
        pd?.scenes?.[selectedScene - 1]?.frameId === frameId;
      if (thumb && stillOnFrame) await loadThumbnail(thumb);
      // Write the result back to projectData by frameId — never by index.
      // This is what was previously clobbering the textarea on the *current*
      // scene when a different scene's generation completed.
      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.frameId === frameId
              ? {
                  ...s,
                  positivePrompt: promptText,
                  thumbnail: thumb || s.thumbnail,
                }
              : s,
          ),
        };
      });
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Generation failed');
    } finally {
      clearLoading();
    }
  };

  /**
   * Merge the captions of N source frames into the new video frame:
   * - de-dupe identical captions
   * - drop empties
   * - join the rest with newlines, in scene order
   */
  const mergeCaptionsFromScenes = (scenes) => {
    const seen = new Set();
    const lines = [];
    for (const s of scenes) {
      const c = (s?.captionSettings?.caption || '').trim();
      if (!c || seen.has(c)) continue;
      seen.add(c);
      lines.push(c);
    }
    return lines.join('\n');
  };

  const makeVideoFrame = async () => {
    if (!isRemote || !authToken || !projectId || !projectData) return;
    // Combined selection set, in scene order.
    const allSelectedNumbers = Array.from(
      new Set([selectedScene, ...multiSelectedScenes]),
    ).sort((a, b) => a - b);
    if (allSelectedNumbers.length < 2) return;

    const sourceScenes = allSelectedNumbers.map(
      (n) => projectData.scenes[n - 1],
    );
    if (sourceScenes.some((s) => !s?.thumbnail)) {
      window.alert('Every selected frame needs a generated visual first.');
      return;
    }
    const lastIdx = allSelectedNumbers[allSelectedNumbers.length - 1] - 1;

    // 2+ refs only mean something to a model that takes an array of refs
    // (reference-to-video, e.g. Happy Horse) or an end frame (image-to-video
    // FLF, e.g. Seedance/Kling). If the default doesn't, pick the first
    // catalog entry that does so the new frame's dropdown is already useful.
    const acceptsMulti = (m) =>
      m && (m.acceptsMultipleReferences || m.supportsEndFrame);
    const defaultModel = falVideoModels.find((m) => m.id === defaultFalVideoModelId);
    const fallback = falVideoModels.find(acceptsMulti);
    const modelForNewFrame = acceptsMulti(defaultModel)
      ? defaultFalVideoModelId
      : (fallback?.id || defaultFalVideoModelId);

    try {
      const addRes = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectId)}/frames`),
        { method: 'POST', headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' } },
      );
      const addBody = await addRes.json().catch(() => ({}));
      if (!addRes.ok) throw new Error(addBody.error || 'Add frame failed');
      const newFrameId = addBody.frame?.id;
      if (!newFrameId) throw new Error('Server did not return a frame id');

      const mergedCaption = mergeCaptionsFromScenes(sourceScenes);
      const sourceCaptionSettings =
        sourceScenes.find((s) => s.captionSettings)?.captionSettings ||
        REMOTE_CAPTION_DEFAULT;
      const captionForFrame = { ...sourceCaptionSettings, caption: mergedCaption };
      const referenceUrls = sourceScenes.map((s) => s.thumbnail);

      await patchFrame(newFrameId, {
        model: modelForNewFrame,
        reference_urls: referenceUrls,
        meta: {
          kind: 'video',
          durationSeconds: 4,
          captionSettings: captionForFrame,
        },
      });

      const currentIds = projectData.scenes.map((s) => s.frameId);
      const newOrder = currentIds.slice();
      const insertAt = lastIdx + 1;
      newOrder.splice(insertAt, 0, newFrameId);

      // Optimistic local update.
      setProjectData((prev) => {
        if (!prev) return prev;
        const placeholder = {
          frameId: newFrameId,
          id: newFrameId,
          thumbnail: '',
          positivePrompt: '',
          references: referenceUrls,
          model: modelForNewFrame,
          voiceline: '',
          speaker: 'Narrator',
          baseModel: '',
          selectedLora: '',
          kind: 'video',
          durationSeconds: 4,
          captionSettings: captionForFrame,
        };
        const nextScenes = prev.scenes.slice();
        nextScenes.splice(insertAt, 0, placeholder);
        return { ...prev, scenes: nextScenes };
      });

      try {
        await reorderFrames(newOrder);
      } catch (e) {
        console.error('Reorder after make-video failed:', e);
      }

      setMultiSelectedScenes([]);
      setSelectedScene(insertAt + 1);
      refetchRemoteProject().catch(() => {});
    } catch (e) {
      console.error(e);
      window.alert(e.message || 'Could not create video frame');
    }
  };

  /**
   * Same flow as makeVideoFrame but sourced from a single image — turns the
   * current frame's visual into a new video frame inserted right after it.
   * The sidebar shortcut for "animate this image" without shift-selecting a pair.
   */
  const makeVideoFrameFromCurrent = async () => {
    if (!isRemote || !authToken || !projectId || !projectData) return;
    const idx = selectedScene - 1;
    const source = projectData.scenes[idx];
    if (!source?.thumbnail) {
      window.alert('Generate a visual on this frame first.');
      return;
    }
    try {
      const addRes = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectId)}/frames`),
        { method: 'POST', headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' } },
      );
      const addBody = await addRes.json().catch(() => ({}));
      if (!addRes.ok) throw new Error(addBody.error || 'Add frame failed');
      const newFrameId = addBody.frame?.id;
      if (!newFrameId) throw new Error('Server did not return a frame id');

      const captionForFrame = {
        ...(source.captionSettings || REMOTE_CAPTION_DEFAULT),
        caption: (source.captionSettings?.caption || '').trim(),
      };
      const referenceUrls = [source.thumbnail];

      await patchFrame(newFrameId, {
        model: defaultImageToVideoModelId,
        reference_urls: referenceUrls,
        meta: {
          kind: 'video',
          durationSeconds: 4,
          captionSettings: captionForFrame,
        },
      });

      const currentIds = projectData.scenes.map((s) => s.frameId);
      const newOrder = currentIds.slice();
      const insertAt = idx + 1;
      newOrder.splice(insertAt, 0, newFrameId);

      setProjectData((prev) => {
        if (!prev) return prev;
        const placeholder = {
          frameId: newFrameId,
          id: newFrameId,
          thumbnail: '',
          positivePrompt: '',
          references: referenceUrls,
          model: defaultImageToVideoModelId,
          voiceline: '',
          speaker: 'Narrator',
          baseModel: '',
          selectedLora: '',
          kind: 'video',
          durationSeconds: 4,
          captionSettings: captionForFrame,
        };
        const next = prev.scenes.slice();
        next.splice(insertAt, 0, placeholder);
        return { ...prev, scenes: next };
      });

      try {
        await reorderFrames(newOrder);
      } catch (e) {
        console.error('Reorder after make-video-from-current failed:', e);
      }

      setMultiSelectedScenes([]);
      setSelectedScene(insertAt + 1);
      refetchRemoteProject().catch(() => {});
    } catch (e) {
      console.error(e);
      window.alert(e.message || 'Could not create video frame');
    }
  };

  const generateVideoForCurrentFrame = async () => {
    if (!isRemote || !authToken || !projectId || !projectData) return;
    const scene = projectData.scenes[selectedScene - 1];
    const targetFrameId = scene?.frameId;
    if (!targetFrameId) return;
    const promptText = String(scene?.positivePrompt || '').trim();
    if (!promptText) {
      window.alert('Enter a video prompt first.');
      return;
    }
    const voiceline = String(voiceText || '').trim();
    const augmentedPrompt = voiceline
      ? `${promptText}\n\nVoiceline (${speakerWav || 'Narrator'}): "${voiceline}"`
      : promptText;
    setCreatingVideoFrameIds((prev) => {
      const next = new Set(prev);
      next.add(targetFrameId);
      return next;
    });
    setVideoError(null);
    setVideoStatusMessage(
      `Sending request to ${selectedFalModel || defaultFalVideoModelId}…`,
    );
    try {
      setVideoStatusMessage('Generating video on fal.ai (this can take 30–90s)…');
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(targetFrameId)}/generate-video`,
        ),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            prompt: augmentedPrompt,
            model: selectedFalModel || defaultFalVideoModelId,
            durationSeconds: sceneDuration,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const required = body.required ?? body.tokenCost;
        const msg =
          body.error ||
          (res.status === 402
            ? `Not enough tokens (need ${required ?? '?'}; you have ${body.tokens ?? '?'})`
            : `Video generation failed (HTTP ${res.status})`);
        throw new Error(msg);
      }
      setVideoStatusMessage('Loading clip…');
      const pd = await refetchRemoteProject();
      const sceneAfter = pd?.scenes?.find((s) => s.frameId === targetFrameId);
      const url = body.frame?.result || sceneAfter?.thumbnail;
      if (!url) throw new Error('Server did not return a video URL.');
      // Only swap the on-screen visual if the user is still on this frame.
      if (pd?.scenes?.[selectedScene - 1]?.frameId === targetFrameId) {
        await loadThumbnail(url);
      }
      setVideoStatusMessage('');
    } catch (e) {
      console.error(e);
      setVideoError(String(e.message || 'Video generation failed'));
      setVideoStatusMessage('');
    } finally {
      setCreatingVideoFrameIds((prev) => {
        if (!prev.has(targetFrameId)) return prev;
        const next = new Set(prev);
        next.delete(targetFrameId);
        return next;
      });
    }
  };

  const addNewScene = () => {
    if (!authToken || !projectId) return;
    fetch(apiUrl(`/projects/${encodeURIComponent(projectId)}/frames`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Add scene failed');
        return refetchRemoteProject();
      })
      .then((pd) => {
        if (!pd) return;
        setVoiceText('');
        setSelectedScene(pd.scenes.length);
        setReferences([]);
      })
      .catch((error) => console.error('Failed to add new scene:', error));
  };

  const startGenerationForScene = (sceneIndex) => {
    const frameId = projectData?.scenes?.[sceneIndex - 1]?.frameId;
    if (!frameId) return;
    setLoadingFrameIds((prev) => {
      if (prev.has(frameId)) return prev;
      const next = new Set(prev);
      next.add(frameId);
      return next;
    });
    setGenerateImageText((prev) => ({ ...prev, [frameId]: 'Generating' }));
    generateImage(frameId);
  };

  // ---------- Fetch fal model catalog (remote only) ----------
  useEffect(() => {
    if (!isRemote || !authToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/projects/models'), {
          headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        if (Array.isArray(body.models)) {
          setFalModels(body.models);
          if (body.defaultId) setDefaultFalModelId(body.defaultId);
        }
        if (Array.isArray(body.videoModels)) {
          setFalVideoModels(body.videoModels);
          if (body.defaultVideoId) setDefaultFalVideoModelId(body.defaultVideoId);
          if (body.defaultImageToVideoId) setDefaultImageToVideoModelId(body.defaultImageToVideoId);
        }
      } catch (e) {
        console.error('Failed to load fal models:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isRemote, authToken]);

  // ---------- Sync scene-bound state when SCENE SELECTION changes ----------
  // Critically, this depends only on the *identity* of the selected frame,
  // not on the whole projectData. Previously, any update to projectData
  // (e.g. another scene's generation completing and refetching) would re-run
  // this and overwrite whatever the user was currently typing in the
  // prompt/voiceline/caption fields. The re-sync should fire only when the
  // user actually navigates to a different frame.
  const currentFrameIdForSync =
    projectData?.scenes?.[selectedScene - 1]?.frameId || null;
  useEffect(() => {
    if (!currentFrameIdForSync || !projectData) return;
    const currentScene = projectData.scenes.find(
      (s) => s.frameId === currentFrameIdForSync,
    );
    if (!currentScene) return;
    setIsTransitioning(true);
    const id = setTimeout(() => {
      setReferences(Array.isArray(currentScene.references) ? currentScene.references : []);
      setSelectedFalModel(currentScene.model || defaultFalModelId);
      setVoiceText(currentScene.voiceline || '');
      setSpeakerWav(currentScene.speaker || 'Narrator');

      setCaptionSettings((prev) => ({
        ...prev,
        ...currentScene.captionSettings,
        fontSize: currentScene.captionSettings?.fontSize || 16,
        captionColor: currentScene.captionSettings?.captionColor || '#FFE600',
        caption: currentScene.captionSettings?.caption || '',
        strokeColor: currentScene.captionSettings?.strokeColor || '#000000',
        strokeSize: currentScene.captionSettings?.strokeSize || 1.5,
        selectedFont: currentScene.captionSettings?.selectedFont || 'Arial',
        selectedWeight: currentScene.captionSettings?.selectedWeight || '700',
      }));

      setLocalCaption(currentScene.captionSettings?.caption || '');
      setSceneDuration(
        Number(currentScene.durationSeconds) ||
          (currentScene.kind === 'video' ? DEFAULT_VIDEO_DURATION : DEFAULT_IMAGE_DURATION),
      );
      setVideoError(null);
      setVideoStatusMessage('');
      setIsTransitioning(false);
    }, 50);
    return () => clearTimeout(id);
    // We intentionally exclude projectData from deps — it would re-fire this
    // whenever any scene's data updates and clobber in-flight typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrameIdForSync]);

  // ---------- Debounced persistence (frames table via API) ----------
  const persistCaptionSettings = useCallback(
    debounce((settingsToPersist, frameId) => {
      if (!frameId || !authToken) return;
      patchFrame(frameId, { meta: { captionSettings: settingsToPersist } }).catch((error) =>
        console.error('Failed to update scene caption settings:', error),
      );
    }, 500),
    [patchFrame, authToken],
  );

  const updateCaptionSettings = useCallback(
    (newSettings) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      // Optimistic: update local state immediately so the preview reflects
      // the font/weight/color/size change without waiting for the API.
      setCaptionSettings((prev) => {
        const merged = { ...prev, ...newSettings };
        if (scene?.frameId) {
          setProjectData((prevData) => {
            if (!prevData) return prevData;
            return {
              ...prevData,
              scenes: prevData.scenes.map((s, index) =>
                index === selectedScene - 1 ? { ...s, captionSettings: merged } : s,
              ),
            };
          });
          persistCaptionSettings(merged, scene.frameId);
        }
        return merged;
      });
    },
    [selectedScene, projectData, persistCaptionSettings],
  );

  // Debounced API persist for the prompt. Keyed by frameId so a delayed
  // network call can't write the wrong frame's prompt if the user has since
  // navigated away.
  const persistScenePromptToApi = useCallback(
    debounce((frameId, positivePrompt) => {
      if (!frameId || !authToken) return;
      patchFrame(frameId, { prompt: positivePrompt }).catch((error) =>
        console.error('Failed to update scene prompts:', error),
      );
    }, 500),
    [patchFrame, authToken],
  );

  const updateSceneFalModel = useCallback(
    (modelId) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken) return;
      patchFrame(scene.frameId, { model: modelId }).catch((error) =>
        console.error('Failed to update scene model:', error),
      );
      setProjectData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === selectedScene - 1 ? { ...s, model: modelId } : s,
        ),
      }));
    },
    [selectedScene, projectData, patchFrame, authToken],
  );

  const updateSceneReferences = useCallback(
    (next) => {
      setReferences(next);
      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s, i) =>
            i === selectedScene - 1 ? { ...s, references: next } : s,
          ),
        };
      });
    },
    [selectedScene],
  );

  const handleAddReferenceFiles = useCallback(
    async (files) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken || !projectId) return;
      setReferencesUploading(true);
      try {
        let latest = references;
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(
            apiUrl(
              `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(scene.frameId)}/references`,
            ),
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${authToken}` },
              body: fd,
            },
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || 'Upload failed');
          if (Array.isArray(body.frame?.reference_urls)) {
            latest = body.frame.reference_urls;
            updateSceneReferences(latest);
          }
        }
      } catch (e) {
        console.error(e);
        window.alert(e.message || 'Reference upload failed');
      } finally {
        setReferencesUploading(false);
      }
    },
    [projectData, selectedScene, authToken, projectId, references, updateSceneReferences],
  );

  const handleAddReferenceUrl = useCallback(
    async (url) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken || !projectId) return;
      setReferencesUploading(true);
      try {
        const res = await fetch(
          apiUrl(
            `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(scene.frameId)}/references`,
          ),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ url }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Upload failed');
        if (Array.isArray(body.frame?.reference_urls)) {
          updateSceneReferences(body.frame.reference_urls);
        }
      } catch (e) {
        console.error(e);
        window.alert(e.message || 'Reference add failed');
      } finally {
        setReferencesUploading(false);
      }
    },
    [projectData, selectedScene, authToken, projectId, updateSceneReferences],
  );

  const handleRemoveReference = useCallback(
    async (url) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken || !projectId) return;
      try {
        const res = await fetch(
          apiUrl(
            `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(scene.frameId)}/references`,
          ),
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ url }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Remove failed');
        if (Array.isArray(body.frame?.reference_urls)) {
          updateSceneReferences(body.frame.reference_urls);
        }
      } catch (e) {
        console.error(e);
        window.alert(e.message || 'Remove failed');
      }
    },
    [projectData, selectedScene, authToken, projectId, updateSceneReferences],
  );

  const updateSceneVoiceline = useCallback(
    debounce((voiceline, speaker) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken) return;
      patchFrame(scene.frameId, {
        meta: { voiceline, speaker },
      }).catch((error) => console.error('Failed to update scene voiceline and speaker:', error));
      setProjectData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === selectedScene - 1 ? { ...s, voiceline, speaker } : s,
        ),
      }));
    }, 500),
    [selectedScene, projectData, patchFrame, authToken],
  );

  // ---------- Form change handlers ----------
  // The textarea is a controlled input wired to the *scene's* positivePrompt
  // (no top-level prompt state). Each keystroke writes optimistically into
  // projectData by the current frame's id, then a debounced PATCH persists.
  const handlePromptChange = (event) => {
    const newPrompt = event.target.value;
    const frameId = projectData?.scenes?.[selectedScene - 1]?.frameId;
    if (!frameId) return;
    setProjectData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.frameId === frameId ? { ...s, positivePrompt: newPrompt } : s,
        ),
      };
    });
    persistScenePromptToApi(frameId, newPrompt);
  };

  const applyVoicelineToCaptionIfEmpty = useCallback(
    (line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed) return;
      const currentCaption = (captionSettings.caption || '').trim();
      if (currentCaption) return;
      setLocalCaption(trimmed);
      updateCaptionSettings({ caption: trimmed });
    },
    [captionSettings.caption, updateCaptionSettings],
  );

  const handleVoiceUpdate = useCallback(
    ({ voiceline, prompt: newPrompt, speaker, editorResponse }) => {
      const nextSpeaker =
        speaker && VOICE_OPTIONS.includes(speaker) ? speaker : null;
      const effectiveSpeaker = nextSpeaker || speakerWav;
      if (nextSpeaker) {
        setSpeakerWav(nextSpeaker);
      }
      const trimmedPrompt = String(newPrompt || '').trim();
      const frameId = projectData?.scenes?.[selectedScene - 1]?.frameId;
      const currentPrompt =
        projectData?.scenes?.[selectedScene - 1]?.positivePrompt || '';
      if (trimmedPrompt && trimmedPrompt !== currentPrompt && frameId) {
        setProjectData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            scenes: prev.scenes.map((s) =>
              s.frameId === frameId ? { ...s, positivePrompt: trimmedPrompt } : s,
            ),
          };
        });
        persistScenePromptToApi(frameId, trimmedPrompt);
      }
      if (typeof voiceline === 'string') {
        const trimmedVoiceline = voiceline.trim();
        setVoiceText(trimmedVoiceline);
        updateSceneVoiceline(trimmedVoiceline, effectiveSpeaker);
        if (trimmedVoiceline) {
          applyVoicelineToCaptionIfEmpty(trimmedVoiceline);
        }
      } else if (nextSpeaker) {
        updateSceneVoiceline(voiceText, effectiveSpeaker);
      }
      if (editorResponse) {
        console.log('[voice] editor:', editorResponse);
      }
    },
    [
      selectedScene,
      projectData,
      voiceText,
      persistScenePromptToApi,
      updateSceneVoiceline,
      speakerWav,
      applyVoicelineToCaptionIfEmpty,
    ],
  );

  const voice = useVoicePrompt({
    onUpdate: handleVoiceUpdate,
    getAuthToken: () => authToken,
    getCurrentPrompt: () =>
      projectData?.scenes?.[selectedScene - 1]?.positivePrompt || '',
    getCurrentVoiceline: () => voiceText,
    getCurrentSpeaker: () => speakerWav,
    getAvailableSpeakers: () => VOICE_OPTIONS,
    getModelId: () => selectedFalModel,
    getReferences: () =>
      (references || [])
        .map((r) => (typeof r === 'string' ? r : r?.url))
        .filter(Boolean),
    getContext: () => {
      if (!projectData?.scenes?.length) return '';
      const lines = projectData.scenes.slice(0, 50).map((s, i) => {
        const p = String(s.positivePrompt || '').trim().slice(0, 240);
        const marker = i + 1 === selectedScene ? ' ← currently editing' : '';
        return `Scene ${i + 1}${marker}: ${p || '(empty)'}`;
      });
      return `Project: ${projectData.name || 'untitled'} (${projectData.scenes.length} scenes)\n${lines.join('\n')}`;
    },
  });

  const handleFalModelChange = (event) => {
    const newId = event.target.value;
    setSelectedFalModel(newId);
    updateSceneFalModel(newId);
  };

  const handleVoiceTextChange = (event) => {
    const newVoiceText = event.target.value;
    setVoiceText(newVoiceText);
    updateSceneVoiceline(newVoiceText, speakerWav);
  };

  const handleSpeakerChange = (event) => {
    const newSpeaker = event.target.value;
    setSpeakerWav(newSpeaker);
    updateSceneVoiceline(voiceText, newSpeaker);
  };

  const handleVoiceTextBlur = () => {
    applyVoicelineToCaptionIfEmpty(voiceText);
  };

  // ---------- Scenes strip ----------
  const handleDeleteScene = (index, skipConfirm = false) => {
    const scene = projectData?.scenes?.[index];
    const frameId = scene?.frameId;
    if (!frameId || !authToken || !projectId || !projectData) return;
    if (projectData.scenes.length <= 1) {
      window.alert('Keep at least one scene.');
      return;
    }
    if (!skipConfirm && !window.confirm('Delete this scene? (Hold Shift to skip)')) return;
    fetch(
      apiUrl(
        `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}`,
      ),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      },
    )
      .then(async (res) => {
        if (!res.ok && res.status !== 204) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Delete failed');
        }
        return refetchRemoteProject();
      })
      .then((updated) => {
        if (!updated) return;
        setVoiceText('');
        if (index + 1 <= selectedScene) {
          setSelectedScene(Math.max(1, selectedScene - 1));
        }
      })
      .catch((error) => console.error('Failed to delete scene:', error));
  };

  const deleteScenesBulk = async (sceneNumbers) => {
    if (!authToken || !projectId || !projectData) return;
    const ids = Array.from(new Set(sceneNumbers))
      .map((n) => projectData.scenes[n - 1]?.frameId)
      .filter(Boolean);
    if (ids.length === 0) return;
    if (projectData.scenes.length - ids.length < 1) {
      window.alert('Keep at least one scene.');
      return;
    }
    for (const frameId of ids) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}`,
        ),
        { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' } },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        console.error('Bulk delete failed for', frameId, body.error || res.status);
      }
    }
    setMultiSelectedScenes([]);
    setSelectedScene((prev) => Math.max(1, prev - ids.length + 1));
    await refetchRemoteProject();
  };

  const handleOpenFolder = (_sceneIndex) => {
    /* Local-project feature; cloud frames have no folder on disk. */
  };

  // ---------- Fonts ----------
  useEffect(() => {
    setSelectedScene(1);
    const fetchFonts = async () => {
      try {
        const fonts = await platform.listSystemFonts();
        setAvailableFonts(fonts);
      } catch (error) {
        console.error('Error fetching fonts:', error);
      }
    };
    fetchFonts();
  }, []);

  // Keep the available-weights dropdown in sync with the currently selected
  // font, but never mutate captionSettings.selectedWeight from here — that
  // belongs to the user's choice (or the saved scene state).
  useEffect(() => {
    const font = availableFonts.find((f) => f.name === captionSettings.selectedFont);
    if (font) {
      setAvailableWeights(font.weights.map((w) => ({ value: w.toString(), label: weightToLabel(w) })));
    }
  }, [availableFonts, captionSettings.selectedFont]);

  const handleFontChange = useCallback((event) => {
    const newFont = event.target.value;
    const font = availableFonts.find((f) => f.name === newFont);
    const next = { selectedFont: newFont };
    // Only swap the weight if the current one isn't offered by the new font.
    if (font) {
      const weights = font.weights.map((w) => w.toString());
      if (!weights.includes(String(captionSettings.selectedWeight))) {
        next.selectedWeight = weights.includes('700') ? '700' : weights[0];
      }
    }
    updateCaptionSettings(next);
  }, [availableFonts, captionSettings.selectedWeight, updateCaptionSettings]);

  const handleWeightChange = useCallback((event) => {
    updateCaptionSettings({ selectedWeight: event.target.value });
  }, [updateCaptionSettings]);

  const handleFontSizeChange = (event) => {
    const newSize = Math.min(99, Math.max(1, parseInt(event.target.value) || 1));
    updateCaptionSettings({ fontSize: newSize });
  };

  const handleColorChange = (event) => updateCaptionSettings({ captionColor: event.target.value });
  const handleStrokeColorChange = (event) => updateCaptionSettings({ strokeColor: event.target.value });
  const handleStrokeSizeChange = (event) => updateCaptionSettings({ strokeSize: event.target.value });
  const handleCaptionChange = (event) => setLocalCaption(event.target.value);
  const handleCaptionBlur = () => updateCaptionSettings({ caption: localCaption });

  // ---------- Random anime fact per scene ----------
  useEffect(() => {
    setCurrentFact(animeFacts[Math.floor(Math.random() * animeFacts.length)]);
  }, [selectedScene]);

  // ---------- Sequential playback ----------
  const stopPlayback = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const advancePlayback = useCallback(() => {
    const scenes = projectData?.scenes || [];
    if (!scenes.length) {
      stopPlayback();
      return;
    }
    setSelectedScene((prev) => {
      // Step forward to the next scene that actually has media; stop if none.
      for (let i = prev + 1; i <= scenes.length; i += 1) {
        if (scenes[i - 1]?.thumbnail) return i;
      }
      stopPlayback();
      return prev;
    });
  }, [projectData, stopPlayback]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    const scenes = projectData?.scenes || [];
    if (!scenes.length) return;
    // If the currently selected scene has no media, jump to the first that does.
    if (!scenes[selectedScene - 1]?.thumbnail) {
      const firstWithMedia = scenes.findIndex((s) => s?.thumbnail);
      if (firstWithMedia === -1) return;
      setSelectedScene(firstWithMedia + 1);
    }
    setIsPlaying(true);
  }, [isPlaying, stopPlayback, projectData, selectedScene]);

  // While playing on an image scene, hold for its duration then advance.
  // Video scenes self-advance via the <video> onEnded handler.
  useEffect(() => {
    if (!isPlaying) return undefined;
    const scene = projectData?.scenes?.[selectedScene - 1];
    if (!scene) {
      stopPlayback();
      return undefined;
    }
    if (scene.kind === 'video') return undefined;
    const dur = Math.max(
      0.1,
      Number(scene.durationSeconds) || DEFAULT_IMAGE_DURATION,
    );
    const id = setTimeout(advancePlayback, dur * 1000);
    playTimerRef.current = id;
    return () => clearTimeout(id);
  }, [isPlaying, selectedScene, projectData, advancePlayback, stopPlayback]);

  useEffect(() => () => {
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
  }, []);

  // ---------- Export ----------
  useEffect(() => {
    const scene = projectData?.scenes?.[selectedScene - 1];
    setCanExportClip(Boolean(scene?.thumbnail));
  }, [projectData, selectedScene]);

  const [exportProgress, setExportProgress] = useState(null);

  /**
   * Pick a save path first (dialog opens immediately on click), then encode
   * via WebCodecs offline, then write the resulting mp4 to that path. The
   * encoder runs at full project resolution and is frame-accurate, so the
   * output matches what the user sees.
   */
  const exportScenesAsMp4 = async (scenes, suggestedName) => {
    const w = imgW || 1280;
    const h = imgH || 720;

    const target = await platform.pickSavePath({
      suggestedName,
      extension: 'mp4',
    });
    if (!target) return null;

    const segments = [];
    for (const s of scenes) {
      const durationSeconds =
        Number(s.durationSeconds) ||
        (s.kind === 'video' ? DEFAULT_VIDEO_DURATION : DEFAULT_IMAGE_DURATION);
      if (s.kind === 'video') {
        segments.push({ kind: 'video', src: s.thumbnail, durationSeconds });
      } else {
        // eslint-disable-next-line no-await-in-loop
        const png = await composeSceneToPng(s, { width: w, height: h });
        segments.push({ kind: 'image', dataUrl: png, durationSeconds });
      }
    }

    setExportProgress(0);
    try {
      const buffer = await encodeSegmentsToMp4(segments, {
        width: w,
        height: h,
        onProgress: (p) => setExportProgress(p),
      });
      return await platform.writeFile(target, buffer);
    } finally {
      setExportProgress(null);
    }
  };

  const handleExportClip = async () => {
    if (!canExportClip || !projectData) return;
    const scene = projectData.scenes[selectedScene - 1];
    if (!scene?.thumbnail) return;
    const sceneWithLive = {
      ...scene,
      captionSettings: {
        ...(scene.captionSettings || {}),
        ...captionSettings,
        caption: localCaption,
      },
    };
    try {
      await exportScenesAsMp4([sceneWithLive], `Scene_${selectedScene}.mp4`);
    } catch (e) {
      console.error('Failed to export clip:', e);
      window.alert(e.message || 'Export failed');
    }
  };

  const handleExportProject = async () => {
    if (!projectData?.scenes?.length) return;
    const scenes = projectData.scenes
      .map((s, i) =>
        i === selectedScene - 1
          ? {
              ...s,
              captionSettings: {
                ...(s.captionSettings || {}),
                ...captionSettings,
                caption: localCaption,
              },
            }
          : s,
      )
      // Skip scenes that have no generated media — they'd show as black.
      .filter((s) => s.thumbnail);
    if (scenes.length === 0) {
      window.alert('Generate a visual on at least one scene before exporting.');
      return;
    }
    try {
      await exportScenesAsMp4(scenes, `${projectData.name || 'project'}.mp4`);
    } catch (e) {
      console.error('Failed to export project:', e);
      window.alert(e.message || 'Export failed');
    }
  };

  // ---------- Render ----------
  if (!authResolved) {
    return <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>Loading…</div>;
  }
  if (!authToken) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        Could not read your session. Close this window and open the project from the launcher again.
      </div>
    );
  }
  if (!projectData) {
    return <ProjectLoadingSkeleton />;
  }

  const currentScene = projectData?.scenes?.[selectedScene - 1];
  const currentFrameId = currentScene?.frameId || null;
  const prompt = currentScene?.positivePrompt || '';
  const isCurrentLoadingImage = currentFrameId
    ? loadingFrameIds.has(currentFrameId)
    : false;
  const isCurrentCreatingVideo = currentFrameId
    ? creatingVideoFrameIds.has(currentFrameId)
    : false;
  const generateDisabled =
    prompt.trim() === '' || isCurrentLoadingImage;
  const isVideoFrame = currentScene?.kind === 'video';

  const handleSceneDurationChange = (event) => {
    const v = Math.max(1, Math.min(30, parseInt(event.target.value, 10) || 1));
    setSceneDuration(v);
    if (currentScene?.frameId) {
      patchFrame(currentScene.frameId, { meta: { durationSeconds: v } }).catch((e) =>
        console.error('Failed to update scene duration:', e),
      );
      setProjectData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === selectedScene - 1 ? { ...s, durationSeconds: v } : s,
        ),
      }));
    }
  };

  return (
    <>
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <EditorLayout
      onExport={handleExportProject}
      onShare={() => setShareOpen(true)}
      showShare={isRemote && Boolean(authToken)}
      voice={voice}
      projectName={projectData?.name}
      leftSidebarProps={{
        falModels: isVideoFrame ? falVideoModels : falModels,
        selectedFalModel,
        onFalModelChange: handleFalModelChange,
        prompt,
        onPromptChange: handlePromptChange,
        promptLabel: isVideoFrame ? 'VIDEO PROMPT' : undefined,
        isTransitioning,
        references,
        onAddReferenceFiles: handleAddReferenceFiles,
        onAddReferenceUrl: handleAddReferenceUrl,
        onRemoveReference: handleRemoveReference,
        referencesUploading,
        modelSupportsReferences: isVideoFrame
          ? true
          : (falModels.find((m) => m.id === selectedFalModel)?.supportsReferences ?? true),
        videoMode: isVideoFrame,
        sceneDuration,
        onSceneDurationChange: handleSceneDurationChange,
        generateLabel: isVideoFrame
          ? (isCurrentCreatingVideo ? 'Creating Video…' : 'Create Video')
          : (generateImageText[currentFrameId] || 'Generate Visuals'),
        generateDisabled: isVideoFrame
          ? (isCurrentCreatingVideo || prompt.trim() === '' || !currentScene?.references?.length)
          : generateDisabled,
        onGenerate: isVideoFrame
          ? () => generateVideoForCurrentFrame()
          : () => startGenerationForScene(selectedScene),
        showMakeVideoFromCurrent: !isVideoFrame && Boolean(currentScene?.thumbnail),
        onMakeVideoFromCurrent: makeVideoFrameFromCurrent,
        makeVideoFromCurrentDisabled: !currentScene?.thumbnail,
      }}
      centerStageProps={{
        aspectRatio: projectAspectRatio,
        scenePreviewProps: {
          thumbnail,
          videoKey,
          isLoading: isCurrentLoadingImage || isCurrentCreatingVideo,
          progress: progressMap[selectedScene],
          fact: currentFact,
          prompt,
          onPromptChange: handlePromptChange,
          generateDisabled: isVideoFrame
            ? (isCurrentCreatingVideo || prompt.trim() === '' || !currentScene?.references?.length)
            : (prompt.trim() === '' || isCurrentLoadingImage),
          onGenerate: isVideoFrame
            ? () => generateVideoForCurrentFrame()
            : () => startGenerationForScene(selectedScene),
          references,
          onAddReferenceFiles: handleAddReferenceFiles,
          onAddReferenceUrl: handleAddReferenceUrl,
          onRemoveReference: handleRemoveReference,
          referencesUploading,
          selected: imageSelected,
          onSelectImage: () => setImageSelected(true),
          caption: localCaption,
          captionSettings,
          isVideoFrame,
          videoStatusMessage,
          videoError,
          onClearVideoError: () => setVideoError(null),
          promptFocusToken,
          isPlaying,
          onVideoEnded: advancePlayback,
        },
        voiceLineProps: {
          voiceText,
          onVoiceTextChange: handleVoiceTextChange,
          onVoiceTextBlur: handleVoiceTextBlur,
          speakerWav,
          onSpeakerChange: handleSpeakerChange,
        },
      }}
      rightSidebarProps={{
        captionProps: {
          captionSettings,
          availableFonts,
          availableWeights,
          onFontChange: handleFontChange,
          onWeightChange: handleWeightChange,
          onFontSizeChange: handleFontSizeChange,
          onColorChange: handleColorChange,
          localCaption,
          onCaptionChange: handleCaptionChange,
          onCaptionBlur: handleCaptionBlur,
        },
        strokeProps: {
          captionSettings,
          onStrokeSizeChange: handleStrokeSizeChange,
          onStrokeColorChange: handleStrokeColorChange,
        },
        exportProps: {
          canExport: canExportClip,
          onExport: handleExportClip,
        },
      }}
      scenesStripProps={{
        projectData,
        selectedScene,
        isPlaying,
        onTogglePlay: togglePlayback,
        canPlay: Boolean(projectData?.scenes?.length),
        pressedScene,
        isMouseDown,
        deletingScenes,
        loadingFrameIds,
        creatingVideoFrameIds,
        thumbnail,
        aspectRatio: projectAspectRatio,
        canExportClip,
        sceneRefs,
        onSceneMouseDown: (sceneNumber) => {
          setPressedScene(sceneNumber);
          setIsMouseDown(true);
        },
        onSceneMouseUp: (sceneNumber, event) => {
          setIsMouseDown(false);
          if (pressedScene === sceneNumber) {
            if (event?.shiftKey) {
              if (sceneNumber !== selectedScene) {
                setMultiSelectedScenes((prev) =>
                  prev.includes(sceneNumber)
                    ? prev.filter((n) => n !== sceneNumber)
                    : [...prev, sceneNumber],
                );
              }
            } else {
              setSelectedScene(sceneNumber);
              setMultiSelectedScenes([]);
            }
          }
          setPressedScene(null);
        },
        multiSelectedScenes,
        onMakeVideoFrame: makeVideoFrame,
        showStoryboard,
        onToggleStoryboard: () => setShowStoryboard((s) => !s),
        onSceneMouseLeave: () => {
          if (isMouseDown) {
            setIsMouseDown(false);
            setPressedScene(null);
          }
        },
        onDeleteScene: handleDeleteScene,
        onOpenFolder: handleOpenFolder,
        onReorderFrames: handleReorderFrames,
        pressedAddScene,
        onAddSceneMouseDown: () => setPressedAddScene(true),
        onAddSceneMouseUp: () => {
          setPressedAddScene(false);
          addNewScene();
        },
        onAddSceneMouseLeave: () => setPressedAddScene(false),
      }}
    />
    {showStoryboard ? (
      <div
        style={{
          position: 'absolute',
          top: 45, // below the title bar
          left: 0,
          right: 0,
          bottom: 0, // covers the scenes strip; the storyboard owns the rest
          zIndex: 50,
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <StoryboardView
          scenes={projectData?.scenes || []}
          aspectRatio={projectAspectRatio}
          loadingFrameIds={loadingFrameIds}
          progressMap={progressMap}
          creatingVideoFrameIds={creatingVideoFrameIds}
          onClose={() => setShowStoryboard(false)}
        />
      </div>
    ) : null}
    </div>
    {shareOpen ? (
      <ShareModal
        projectId={projectId}
        authToken={authToken}
        onClose={() => setShareOpen(false)}
      />
    ) : null}
    {exportProgress != null ? (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 10,
            padding: '20px 24px',
            minWidth: 280,
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            Exporting… {Math.round(exportProgress * 100)}%
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              backgroundColor: '#EEE',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round(exportProgress * 100)}%`,
                height: '100%',
                backgroundColor: '#1F93FF',
                transition: 'width 80ms linear',
              }}
            />
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
};

export default ProjectComponent;
