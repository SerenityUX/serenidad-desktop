import React, { useEffect, useState, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { useInterval } from 'react-use';
import ollama from 'ollama/browser';

import animeFacts from '../../data/animeFacts.json';
import { apiUrl } from '../../config';
import EditorLayout from './EditorLayout';
import ComposeLayout from './ComposeLayout';
import ShareModal from './ShareModal';
import ProjectLoadingSkeleton from './ProjectLoadingSkeleton';
import { composeSceneToPng } from '../../lib/composeScene';
import useVoicePrompt from '../../hooks/useVoicePrompt';

const SECONDS_PER_FRAME = 2;

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
        kind: meta.kind === 'video' ? 'video' : 'image',
        durationSeconds: Number(meta.durationSeconds) || null,
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
  const isRemote = Boolean(projectId);
  // Mode flags
  const [composeMode, setComposeMode] = useState(false);
  const [composeComplete, setComposeComplete] = useState(false);
  const [storyboardMode, setStoryboardMode] = useState(false);

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
  const [sceneDuration, setSceneDuration] = useState(null);
  const [thumbnailTimestamps, setThumbnailTimestamps] = useState({});

  // Compose mode
  const [composeUserInput, setComposeUserInput] = useState('');
  const [composeSubmitted, setComposeSubmitted] = useState(false);
  const [enrichedStory, setEnrichedStory] = useState('');
  const [characters, setCharacters] = useState([]);

  // Voice
  const [voiceText, setVoiceText] = useState('');
  const [speakerWav, setSpeakerWav] = useState('Narrator');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [generateText, setGenerateText] = useState('Generate Voice');
  const [voices, setVoices] = useState([]);

  // Models
  const [baseModel, setBaseModel] = useState('');
  const [selectedLora, setSelectedLora] = useState('');
  const [baseModels, setBaseModels] = useState([]);
  const [loraModules, setLoraModules] = useState([]);

  // Prompt
  const [prompt, setPrompt] = useState('');
  const [promptFocusToken, setPromptFocusToken] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fal models + per-scene picks
  const [falModels, setFalModels] = useState([]);
  const [defaultFalModelId, setDefaultFalModelId] = useState('fal-ai/nano-banana-2');
  const [selectedFalModel, setSelectedFalModel] = useState('fal-ai/nano-banana-2');
  const [falVideoModels, setFalVideoModels] = useState([]);
  const [defaultFalVideoModelId, setDefaultFalVideoModelId] = useState('fal-ai/happy-horse/image-to-video');

  // Multi-select for "Make Video Frame" — array of scene numbers (1-based)
  // that are *additionally* selected via shift-click; the primary
  // `selectedScene` is always also part of the visual multi-selection.
  const [multiSelectedScenes, setMultiSelectedScenes] = useState([]);

  // Video frame state (per-scene fields, hydrated when selectedScene changes)
  const [videoDuration, setVideoDuration] = useState(4);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [videoStatusMessage, setVideoStatusMessage] = useState('');

  // References
  const [references, setReferences] = useState([]);
  const [referencesUploading, setReferencesUploading] = useState(false);

  // Image selection (for cmd+c / cmd+v on the generated visual)
  const [imageSelected, setImageSelected] = useState(false);

  // Generation
  const [currentlyLoading, setCurrentlyLoading] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [progressMessageMap, setProgressMessageMap] = useState({});
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
    if (!isRemote) {
      setAuthResolved(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const t = await window.electron.getViewerAuthToken();
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
  }, [isRemote]);

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

  // ---------- Compose: enrich story via ollama ----------
  const fetchEnrichment = async () => {
    const message = {
      role: 'user',
      content: `Please enrich my story by giving it specific details about specific actions taking place and a start, rising action, and climax and very specific characters. Do not use nicknames and always only refer to people by their first name (not their title or by mrs or mr. or miss.). Respond with nothing but the enriched version: ${composeUserInput}.`,
    };
    const response = await ollama.chat({ model: 'llama3.1', messages: [message], stream: true });
    let output = '';
    for await (const part of response) {
      output += part.message.content;
      setEnrichedStory(output);
    }

    const characterMessage = {
      role: 'user',
      content: `Please provide a comma-separated list of the characters' names from the previous response for every character in the story. Make sure to not repeat characters & only include them by their normal name (not nickname). Respond with nothing but the character comma separated list and no clarifying message before or after. No clarifications or notes.    ${output}`,
    };
    const characterResponse = await ollama.chat({ model: 'llama3.1', messages: [characterMessage], stream: true });
    let characterOutput = '';
    for await (const part of characterResponse) {
      characterOutput += part.message.content;
    }
    const uniqueCharacters = [...new Set(characterOutput.split(',').map((name) => name.trim()))];
    const characterObjects = uniqueCharacters.map((name) => ({ name, plotDescription: '', visualDescription: '' }));
    setCharacters(characterObjects);

    for (let i = 0; i < characterObjects.length; i++) {
      const character = characterObjects[i];
      const plotMessage = {
        role: 'user',
        content: `Please provide me a one sentence plot description of ${character.name}. FOCUS ON JUST THIS CHARACTER AND THEIR ROLE IN THE STORY, NOT THE ENVIRONMENT. Do not provide any sort of clarification to your message like: "Here's the plot description" respond with only the sentence. Here's the story: ${output}`,
      };
      const characterPlotDescription = await ollama.chat({ model: 'llama3.1', messages: [plotMessage] });
      const plotDescription = characterPlotDescription.message.content;
      setCharacters((prev) =>
        prev.map((item) => (item.name === character.name ? { ...item, plotDescription } : item)),
      );
    }

    for (let i = 0; i < characterObjects.length; i++) {
      const character = characterObjects[i];
      const visualMessage = {
        role: 'user',
        content: `Please provide me a keyword comma separated visual descripton (for a stable diffusion 1.5 prompt) of ${character.name}. DO NOT DESCRIBE THEIR ENVIRONMENT BUT RATHER ONLY SPECIFIC VISUAL FEATURES OF THE CHARACTER GENERALIZABLE THROUGHOUT TIME. Do not provide any sort of clarification to your message like: "Here's the visual description" respond with only the comma separated list of specific visual keywords that decide things like their gender, age, race (white, black, asian, hispanic, native american, middle eastern, indian, etc) (or if a non-human creature then mention the creature type and the color of the create like blue, green, orange, yellow, red, etc), hair color, eye color, outfit, etc based on the role they play in the story. ONLY VISUALS, NOTHING PLOT-RELATED. Here's the story: ${output}`,
      };
      const characterVisualDescription = await ollama.chat({ model: 'llama3.1', messages: [visualMessage] });
      const visualDescription = characterVisualDescription.message.content;
      setCharacters((prev) =>
        prev.map((item) => (item.name === character.name ? { ...item, visualDescription } : item)),
      );
    }
    setComposeComplete(true);
  };

  // ---------- Voice generation ----------
  const generateVoiceLine = async (_sceneIndex) => {
    window.alert('Voice generation is not available for cloud-only projects in this build.');
  };

  useEffect(() => {
    if (isRemote) return undefined;
    const checkVoiceGenerationStatus = async () => {
      const status = await window.electron.ipcRenderer.invoke('check-voice-generation-status', selectedScene);
      setIsGeneratingVoice(status);
      setGenerateText(status ? 'Generating' : 'Generate Voice');
    };
    checkVoiceGenerationStatus();
    const intervalId = setInterval(checkVoiceGenerationStatus, 1000);
    return () => clearInterval(intervalId);
  }, [selectedScene, isRemote]);

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
      setPrompt('');
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
    setSceneDuration(null);
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
  const generateImage = async (sceneIndex) => {
    if (!isRemote) {
      window.alert('Local GPU generation is disabled for cloud-backed projects in this build.');
      return;
    }
    const scene = projectData?.scenes?.[sceneIndex - 1];
    if (!scene?.frameId || !authToken || !projectId) return;
    const promptText = String(prompt || '').trim();
    if (!promptText) {
      window.alert('Enter a prompt first.');
      setCurrentlyLoading((prev) => prev.filter((s) => s !== sceneIndex));
      setGenerateImageText((prev) => ({ ...prev, [sceneIndex]: 'Generate Visuals' }));
      return;
    }
    try {
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(scene.frameId)}/generate-image`,
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
      const thumb = body.frame?.result || pd?.scenes?.[sceneIndex - 1]?.thumbnail;
      // Wait for the actual image bytes to land in the browser cache before
      // flipping out of the loading state — otherwise we briefly show the
      // empty Scene Visual placeholder while the network fetch finishes.
      if (thumb) await loadThumbnail(thumb);
      setGenerateImageText((prev) => ({ ...prev, [sceneIndex]: 'Generated' }));
      setProjectData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s, i) =>
            i === sceneIndex - 1
              ? {
                  ...s,
                  positivePrompt: promptText,
                  thumbnail: thumb || s.thumbnail,
                }
              : s,
          ),
        };
      });
      setPrompt(promptText);
    } catch (err) {
      console.error(err);
      window.alert(err.message || 'Generation failed');
      setGenerateImageText((prev) => ({ ...prev, [sceneIndex]: 'Generate Visuals' }));
    } finally {
      setCurrentlyLoading((prev) => prev.filter((s) => s !== sceneIndex));
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
        model: defaultFalVideoModelId,
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
          model: defaultFalVideoModelId,
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
        model: defaultFalVideoModelId,
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
          model: defaultFalVideoModelId,
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
    if (!scene?.frameId) return;
    const promptText = String(prompt || '').trim();
    if (!promptText) {
      window.alert('Enter a video prompt first.');
      return;
    }
    setCreatingVideo(true);
    setVideoError(null);
    setVideoStatusMessage(
      `Sending request to ${selectedFalModel || defaultFalVideoModelId}…`,
    );
    try {
      setVideoStatusMessage('Generating video on fal.ai (this can take 30–90s)…');
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(scene.frameId)}/generate-video`,
        ),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            prompt: promptText,
            model: selectedFalModel || defaultFalVideoModelId,
            durationSeconds: videoDuration,
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
      const url = body.frame?.result || pd?.scenes?.[selectedScene - 1]?.thumbnail;
      if (!url) throw new Error('Server did not return a video URL.');
      await loadThumbnail(url);
      setVideoStatusMessage('');
    } catch (e) {
      console.error(e);
      setVideoError(String(e.message || 'Video generation failed'));
      setVideoStatusMessage('');
    } finally {
      setCreatingVideo(false);
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
        setPrompt('');
      })
      .catch((error) => console.error('Failed to add new scene:', error));
  };

  useEffect(() => {
    const handleProgressUpdate = (event, sceneIndex, progressPercent) => {
      setProgressMap((prev) => ({ ...prev, [event]: sceneIndex }));
      setProgressMessageMap((prev) => ({ ...prev, [event]: `${sceneIndex}% Complete` }));
      if (parseInt(sceneIndex) >= 95) {
        setTimeout(() => {
          setCurrentlyLoading((prev) => prev.filter((scene) => scene !== event));
          setGenerateImageText((prev) => ({ ...prev, [event]: 'Generate Visuals' }));
        }, 2000);
      }
    };

    const handleModelResponse = (event, sceneIndex, response) => {
      if (sceneIndex.success === false && sceneIndex.message !== 'Process exited with code 1') {
        alert(sceneIndex.message);
        setCurrentlyLoading((prev) => prev.filter((scene) => scene !== event));
      }
      if (response.success) {
        setProgressMessageMap((prev) => ({ ...prev, [sceneIndex]: 'Generation Complete!' }));
        setCurrentlyLoading((prev) => prev.filter((scene) => scene !== sceneIndex));
        setGenerateImageText((prev) => ({ ...prev, [sceneIndex]: 'Generated' }));
      } else {
        setProgressMessageMap((prev) => ({ ...prev, [sceneIndex]: 'Generation Failed!' }));
        setGenerateImageText((prev) => ({ ...prev, [sceneIndex]: 'Generate Visuals' }));
      }
    };

    window.electron.on('progress-update', handleProgressUpdate);
    window.electron.on('run-model-response', handleModelResponse);
    return () => {
      window.electron.off('progress-update', handleProgressUpdate);
      window.electron.off('run-model-response', handleModelResponse);
    };
  }, []);

  const startGenerationForScene = (sceneIndex) => {
    setCurrentlyLoading((prev) => [...prev, sceneIndex]);
    setGenerateImageText((prev) => ({ ...prev, [sceneIndex]: 'Generating' }));
    generateImage(sceneIndex);
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
        }
      } catch (e) {
        console.error('Failed to load fal models:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isRemote, authToken]);

  // ---------- Sync scene-bound state when selection changes ----------
  useEffect(() => {
    if (projectData && projectData.scenes[selectedScene - 1]) {
      setIsTransitioning(true);
      const currentScene = projectData.scenes[selectedScene - 1];
      setTimeout(() => {
        setPrompt(currentScene.positivePrompt || '');
        setReferences(Array.isArray(currentScene.references) ? currentScene.references : []);
        setSelectedFalModel(currentScene.model || defaultFalModelId);
        setVoiceText(currentScene.voiceline || '');
        setSpeakerWav(currentScene.speaker || 'Narrator');
        fetchBaseModels();
        fetchLoraModules();
        setBaseModel(currentScene.baseModel || baseModels[0]);
        setSelectedLora(currentScene.selectedLora || loraModules[0]);

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
        setVideoDuration(Number(currentScene.durationSeconds) || 4);
        setVideoError(null);
        setVideoStatusMessage('');
        setIsTransitioning(false);
      }, 50);
    }
  }, [selectedScene, projectData]);

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

  const updateScenePrompts = useCallback(
    debounce((positivePrompt) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken) return;
      patchFrame(scene.frameId, {
        prompt: positivePrompt,
      }).catch((error) => console.error('Failed to update scene prompts:', error));
      setProjectData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === selectedScene - 1
            ? { ...s, positivePrompt }
            : s,
        ),
      }));
    }, 500),
    [selectedScene, projectData, patchFrame, authToken],
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

  const updateSceneModelSettings = useCallback(
    debounce((baseModelValue, selectedLoraValue) => {
      const scene = projectData?.scenes?.[selectedScene - 1];
      if (!scene?.frameId || !authToken) return;
      patchFrame(scene.frameId, {
        meta: { baseModel: baseModelValue, selectedLora: selectedLoraValue },
      }).catch((error) => console.error('Failed to update scene model settings:', error));
      setProjectData((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === selectedScene - 1
            ? { ...s, baseModel: baseModelValue, selectedLora: selectedLoraValue }
            : s,
        ),
      }));
    }, 500),
    [selectedScene, projectData, patchFrame, authToken],
  );

  // ---------- Form change handlers ----------
  const handlePromptChange = (event) => {
    const newPrompt = event.target.value;
    setPrompt(newPrompt);
    updateScenePrompts(newPrompt);
  };

  const handleVoicePrompt = useCallback(
    (text) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return;
      setPrompt(trimmed);
      updateScenePrompts(trimmed);
    },
    [updateScenePrompts],
  );

  const voice = useVoicePrompt({
    onPrompt: handleVoicePrompt,
    getAuthToken: () => authToken,
    getCurrentPrompt: () => prompt,
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

  const handleSpeakerChange = async (event) => {
    const newSpeaker = event.target.value;
    if (newSpeaker === 'add-voice') {
      await handleAddVoice();
    } else {
      setSpeakerWav(newSpeaker);
      updateSceneVoiceline(voiceText, newSpeaker);
    }
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
        const fonts = await window.electron.ipcRenderer.invoke('get-system-fonts');
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

  // ---------- Models (local GPU weights only; cloud projects skip) ----------
  const fetchBaseModels = useCallback(async () => {
    if (isRemote) {
      setBaseModels([]);
      return;
    }
    try {
      const models = await window.electron.ipcRenderer.invoke('get-base-models');
      setBaseModels(models);
    } catch (error) {
      console.error('Failed to fetch base models:', error);
    }
  }, [isRemote]);

  const fetchLoraModules = useCallback(async () => {
    if (isRemote) {
      setLoraModules([]);
      return;
    }
    try {
      const modules = await window.electron.ipcRenderer.invoke('get-lora-modules');
      setLoraModules(modules);
    } catch (error) {
      console.error('Failed to fetch LoRA modules:', error);
    }
  }, [isRemote]);

  useEffect(() => {
    fetchBaseModels();
    fetchLoraModules();
  }, [fetchBaseModels, fetchLoraModules]);

  const handleBaseModelChange = async (event) => {
    const newBaseModel = event.target.value;
    if (newBaseModel === 'manage') {
      window.electron.ipcRenderer.send('open-manage-window', 'baseModel');
    } else {
      setBaseModel(newBaseModel);
      updateSceneModelSettings(newBaseModel, selectedLora);
    }
  };

  const handleLoraChange = async (event) => {
    const newSelectedLora = event.target.value;
    if (newSelectedLora === 'manage') {
      window.electron.ipcRenderer.send('open-manage-window', 'lora');
    } else {
      setSelectedLora(newSelectedLora);
      updateSceneModelSettings(baseModel, newSelectedLora);
    }
  };

  // ---------- Random anime fact per scene ----------
  useEffect(() => {
    setCurrentFact(animeFacts[Math.floor(Math.random() * animeFacts.length)]);
  }, [selectedScene]);

  // ---------- Voices ----------
  useEffect(() => {
    loadVoices();
  }, [isRemote]);

  const loadVoices = async () => {
    if (isRemote) {
      setVoices([]);
      return;
    }
    try {
      const voiceFiles = await window.electron.ipcRenderer.invoke('get-voices');
      setVoices(voiceFiles);
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  };

  const handleAddVoice = async () => {
    if (isRemote) {
      window.alert('Voice files live on disk in this app; cloud-only mode does not add voices yet.');
      return;
    }
    try {
      const result = await window.electron.ipcRenderer.invoke('add-voice');
      if (result) {
        await loadVoices();
        const newVoiceName = result.split('.')[0];
        setSpeakerWav(newVoiceName);
        updateSceneVoiceline(voiceText, newVoiceName);
      }
    } catch (error) {
      console.error('Failed to add voice:', error);
    }
  };

  // ---------- Export ----------
  useEffect(() => {
    const checkExportability = async () => {
      if (isRemote) {
        const scene = projectData?.scenes?.[selectedScene - 1];
        setCanExportClip(Boolean(scene?.thumbnail));
        return;
      }
      if (projectData && projectData.scenes[selectedScene - 1]) {
        const scene = projectData.scenes[selectedScene - 1];
        const mp4Path = '';
        const pngPath = scene.thumbnail;
        const mp4Exists = await window.electron.ipcRenderer.invoke('check-file-exists', mp4Path);
        const pngExists = await window.electron.ipcRenderer.invoke('check-file-exists', pngPath);
        setCanExportClip(mp4Exists || pngExists);
      }
    };
    checkExportability();
  }, [projectData, selectedScene, isRemote]);

  const exportScenesAsMp4 = async (scenes, suggestedName) => {
    const w = imgW || 1280;
    const h = imgH || 720;
    const pngs = [];
    for (const s of scenes) {
      // eslint-disable-next-line no-await-in-loop
      const png = await composeSceneToPng(s, { width: w, height: h });
      pngs.push(png);
    }
    return window.electron.ipcRenderer.invoke('export-project-mp4', {
      pngDataUrls: pngs,
      secondsPerFrame: SECONDS_PER_FRAME,
      suggestedName,
    });
  };

  const handleExportClip = async () => {
    if (!isRemote) {
      if (!canExportClip) return;
      const scene = projectData.scenes[selectedScene - 1];
      try {
        const exportPath = await window.electron.ipcRenderer.invoke('export-clip', '', scene.thumbnail, selectedScene);
        if (exportPath) console.log(`Clip exported successfully to: ${exportPath}`);
      } catch (error) {
        console.error('Failed to export clip:', error);
      }
      return;
    }
    if (!canExportClip || !projectData) return;
    const scene = projectData.scenes[selectedScene - 1];
    if (!scene?.thumbnail) return;
    // Use the live caption text the user just typed even if not yet saved.
    const sceneWithLive = {
      ...scene,
      captionSettings: {
        ...(scene.captionSettings || {}),
        ...captionSettings,
        caption: localCaption,
      },
    };
    try {
      const out = await exportScenesAsMp4([sceneWithLive], `Scene_${selectedScene}.mp4`);
      if (out) console.log('Clip exported to', out);
    } catch (e) {
      console.error('Failed to export clip:', e);
      window.alert(e.message || 'Export failed');
    }
  };

  const handleExportProject = async () => {
    if (!isRemote) {
      window.electron.ipcRenderer.invoke('render-project', '')
        .then(() => console.log('Rendering completed and opened in Finder.'))
        .catch((error) => console.error('Error rendering project:', error));
      return;
    }
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
      .filter((s) => s.thumbnail);
    if (scenes.length === 0) {
      window.alert('Generate a visual on at least one scene before exporting.');
      return;
    }
    try {
      const out = await exportScenesAsMp4(scenes, `${projectData.name || 'project'}.mp4`);
      if (out) console.log('Project exported to', out);
    } catch (e) {
      console.error('Failed to export project:', e);
      window.alert(e.message || 'Export failed');
    }
  };

  // ---------- Thumbnail freshness polling (local files only) ----------
  useInterval(() => {
    if (isRemote) return;
    if (projectData && projectData.scenes) {
      projectData.scenes.forEach(async (scene, index) => {
        const lastModified = await window.electron.ipcRenderer.invoke('check-file-updated', scene.thumbnail);
        if (lastModified) {
          setThumbnailTimestamps((prev) => ({ ...prev, [index + 1]: lastModified }));
        }
      });
    }
  }, 1000);

  // ---------- Image generation error events ----------
  useEffect(() => {
    const handleImageGenerationError = (event, data) => {
      alert(`Image generation failed: ${data.errorMessage}`);
      setCurrentlyLoading((prev) => prev.filter((scene) => scene !== data.sceneIndex));
      setGenerateImageText((prev) => ({ ...prev, [data.sceneIndex]: 'Generate Visuals' }));
    };
    window.electron.on('image-generation-error', handleImageGenerationError);
    return () => window.electron.off('image-generation-error', handleImageGenerationError);
  }, []);

  // ---------- Render ----------
  if (isRemote) {
    if (!authResolved) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>Loading…</div>
      );
    }
    if (!authToken) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          Could not read your session. Close this window and open the project from the launcher again.
        </div>
      );
    }
    if (!projectId) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          Missing project id in the URL.
        </div>
      );
    }
    if (!projectData) {
      return <ProjectLoadingSkeleton />;
    }
  }

  if (composeMode) {
    return (
      <ComposeLayout
        storyboardMode={storyboardMode}
        composeUserInput={composeUserInput}
        onComposeInputChange={setComposeUserInput}
        composeSubmitted={composeSubmitted}
        onSubmitStory={() => {
          setComposeSubmitted(true);
          fetchEnrichment();
        }}
        enrichedStory={enrichedStory}
        characters={characters}
        composeComplete={composeComplete}
        onGenerateStoryboard={() => setStoryboardMode(true)}
      />
    );
  }

  const generateDisabled =
    prompt.trim() === '' ||
    currentlyLoading.includes(selectedScene) ||
    (!isRemote && baseModels.length === 0 && loraModules.length === 0);

  const currentScene = projectData?.scenes?.[selectedScene - 1];
  const isVideoFrame = currentScene?.kind === 'video';

  const handleVideoDurationChange = (event) => {
    const v = Math.max(1, Math.min(30, parseInt(event.target.value, 10) || 1));
    setVideoDuration(v);
    if (currentScene?.frameId) {
      patchFrame(currentScene.frameId, { meta: { durationSeconds: v } }).catch((e) =>
        console.error('Failed to update video duration:', e),
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
    <EditorLayout
      onExport={handleExportProject}
      onShare={() => setShareOpen(true)}
      showShare={isRemote && Boolean(authToken)}
      voice={voice}
      leftSidebarProps={{
        baseModel,
        baseModels,
        onBaseModelChange: handleBaseModelChange,
        onBaseModelOpen: fetchBaseModels,
        selectedLora,
        loraModules,
        onLoraChange: handleLoraChange,
        onLoraOpen: fetchLoraModules,
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
        sceneDuration,
        videoMode: isVideoFrame,
        videoDuration,
        onVideoDurationChange: handleVideoDurationChange,
        generateLabel: isVideoFrame
          ? (creatingVideo ? 'Creating Video…' : 'Create Video')
          : (generateImageText[selectedScene] || 'Generate Visuals'),
        generateDisabled: isVideoFrame
          ? (creatingVideo || prompt.trim() === '' || !currentScene?.references?.length)
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
          isLoading: currentlyLoading.includes(selectedScene) || creatingVideo,
          progress: progressMap[selectedScene],
          fact: currentFact,
          prompt,
          onPromptChange: handlePromptChange,
          generateDisabled: isVideoFrame
            ? (creatingVideo || prompt.trim() === '' || !currentScene?.references?.length)
            : (prompt.trim() === '' ||
               currentlyLoading.includes(selectedScene) ||
               (!isRemote && baseModels.length === 0 && loraModules.length === 0)),
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
        },
        voiceLineProps: {
          voiceText,
          onVoiceTextChange: handleVoiceTextChange,
          speakerWav,
          voices,
          onSpeakerChange: handleSpeakerChange,
          onGenerateVoice: () => generateVoiceLine(selectedScene),
          isGeneratingVoice,
          generateText,
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
        pressedScene,
        isMouseDown,
        deletingScenes,
        currentlyLoading,
        thumbnail,
        thumbnailTimestamps,
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
    {shareOpen ? (
      <ShareModal
        projectId={projectId}
        authToken={authToken}
        onClose={() => setShareOpen(false)}
      />
    ) : null}
    </>
  );
};

export default ProjectComponent;
