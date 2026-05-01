import React, { useEffect, useState, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { useInterval } from 'react-use';
import ollama from 'ollama/browser';

import animeFacts from '../../data/animeFacts.json';
import EditorLayout from './EditorLayout';
import ComposeLayout from './ComposeLayout';

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

const ProjectComponent = ({ filePath }) => {
  // Mode flags
  const [composeMode, setComposeMode] = useState(false);
  const [composeComplete, setComposeComplete] = useState(false);
  const [storyboardMode, setStoryboardMode] = useState(false);

  // Project data + selection
  const [projectData, setProjectData] = useState(null);
  const [thumbnail, setThumbnail] = useState('');
  const [aspectRatio, setAspectRatio] = useState(1);
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
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

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
  const generateVoiceLine = async (sceneIndex) => {
    const outputLocation = `${filePath.split('/project.kodan')[0]}/Voicelines/${sceneIndex}.mp3`;
    const language = 'en';

    setIsGeneratingVoice(true);
    setGenerateText('Generating');

    window.electron.send('run-voice-model', {
      prompt: voiceText,
      outputLocation,
      speakerWav,
      language,
    });

    window.electron.once('voice-model-response', (event, response) => {
      setIsGeneratingVoice(false);
      setGenerateText('Generate Voice');
      if (response.success) {
        console.log('Voice generation completed successfully!');
      } else {
        console.error('Voice generation failed:', response.message);
      }
    });
  };

  useEffect(() => {
    const checkVoiceGenerationStatus = async () => {
      const status = await window.electron.ipcRenderer.invoke('check-voice-generation-status', selectedScene);
      setIsGeneratingVoice(status);
      setGenerateText(status ? 'Generating' : 'Generate Voice');
    };
    checkVoiceGenerationStatus();
    const intervalId = setInterval(checkVoiceGenerationStatus, 1000);
    return () => clearInterval(intervalId);
  }, [selectedScene]);

  // ---------- Keyboard scene navigation ----------
  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
      if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !isInputFocused) {
        setVoiceText('');
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
  }, [projectData, selectedScene]);

  // ---------- Watch for mp4 vs png updates ----------
  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (projectData && projectData.scenes.length > 0) {
        const scene = projectData.scenes[selectedScene - 1];
        const mp4Path = `${filePath.split('/project.kodan')[0]}/Clips/${selectedScene}.mp4`;
        const fileModifiedTime = await window.electron.ipcRenderer.invoke('check-file-updated', mp4Path);

        if (fileModifiedTime) {
          setThumbnail(`${mp4Path}`);
          setRefreshKey(Date.now());
          setVideoKey(fileModifiedTime);
          const duration = await window.electron.ipcRenderer.invoke('get-video-duration', mp4Path);
          setSceneDuration(duration);
        } else {
          loadThumbnail(scene.thumbnail);
          setSceneDuration(null);
        }
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [projectData, selectedScene, refreshKey]);

  // ---------- Initial project load ----------
  useEffect(() => {
    if (!filePath) {
      console.error('Project viewer: missing filePath (check window URL query).');
      return;
    }
    const loadProjectData = async () => {
      try {
        const data = await window.electron.invoke('read-project-kodan', filePath);
        setProjectData(data);
        if (data?.scenes?.length > 0) {
          const scene = data.scenes[selectedScene - 1];
          if (scene?.thumbnail) loadThumbnail(scene.thumbnail);
        }
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };
    loadProjectData();
  }, [filePath, selectedScene]);

  const loadThumbnail = (thumbnailPath) => {
    const img = new Image();
    img.src = thumbnailPath;
    img.onload = () => {
      setThumbnail(thumbnailPath);
      setAspectRatio(img.width / img.height);
      setImgW(img.width);
      setImgH(img.height);
    };
    img.onerror = () => {
      setThumbnail(null);
      console.error('Error loading thumbnail image.');
    };
  };

  // ---------- Image generation ----------
  const generateImage = async (sceneIndex) => {
    window.electron.send('run-model', {
      outputPath: filePath.split('/project.kodan')[0] + `/Images/${sceneIndex}.png`,
      aspectRatio,
      prompt,
      negativePrompt,
      width: imgW,
      height: imgH,
      sceneIndex,
      baseModel,
      loraModule: selectedLora,
    });
  };

  const addNewScene = () => {
    window.electron.ipcRenderer.invoke('add-new-scene', filePath, aspectRatio)
      .then((updatedProjectData) => {
        setProjectData(updatedProjectData);
        setVoiceText('');
        setSelectedScene(updatedProjectData.scenes.length);
        setNegativePrompt('');
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

  // ---------- Sync scene-bound state when selection changes ----------
  useEffect(() => {
    if (projectData && projectData.scenes[selectedScene - 1]) {
      setIsTransitioning(true);
      const currentScene = projectData.scenes[selectedScene - 1];
      setTimeout(() => {
        setPrompt(currentScene.positivePrompt || '');
        setNegativePrompt(currentScene.negativePrompt || '');
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
        setIsTransitioning(false);
      }, 50);
    }
  }, [selectedScene, projectData]);

  // ---------- Debounced persistence ----------
  const updateCaptionSettings = useCallback(
    debounce(async (newSettings) => {
      try {
        const updatedSettings = { ...captionSettings, ...newSettings };
        await window.electron.ipcRenderer.invoke('update-scene-caption', filePath, selectedScene, updatedSettings);
        if (thumbnail) {
          const refreshedThumbnail = await window.electron.ipcRenderer.invoke('update-caption', filePath, selectedScene, updatedSettings);
          setThumbnail(refreshedThumbnail);
          setProjectData((prevData) => ({
            ...prevData,
            scenes: prevData.scenes.map((scene, index) =>
              index === selectedScene - 1
                ? { ...scene, thumbnail: refreshedThumbnail, captionSettings: updatedSettings }
                : scene,
            ),
          }));
          setCaptionSettings(updatedSettings);
        }
      } catch (error) {
        console.error('Failed to update scene caption settings:', error);
      }
    }, 500),
    [filePath, selectedScene, thumbnail, captionSettings],
  );

  const updateScenePrompts = useCallback(
    debounce((positivePrompt, negativePromptValue) => {
      window.electron.ipcRenderer.invoke('update-scene-prompts', filePath, selectedScene, positivePrompt, negativePromptValue)
        .catch((error) => console.error('Failed to update scene prompts:', error));
    }, 500),
    [filePath, selectedScene],
  );

  const updateSceneVoiceline = useCallback(
    debounce((voiceline, speaker) => {
      window.electron.ipcRenderer.invoke('update-scene-voiceline', filePath, selectedScene, voiceline, speaker)
        .catch((error) => console.error('Failed to update scene voiceline and speaker:', error));
    }, 500),
    [filePath, selectedScene],
  );

  const updateSceneModelSettings = useCallback(
    debounce((baseModelValue, selectedLoraValue) => {
      window.electron.ipcRenderer.invoke('update-scene-model-settings', filePath, selectedScene, baseModelValue, selectedLoraValue)
        .catch((error) => console.error('Failed to update scene model settings:', error));
    }, 500),
    [filePath, selectedScene],
  );

  // ---------- Form change handlers ----------
  const handlePromptChange = (event) => {
    const newPrompt = event.target.value;
    setPrompt(newPrompt);
    updateScenePrompts(newPrompt, negativePrompt);
  };

  const handleNegativePromptChange = (event) => {
    const newNegativePrompt = event.target.value;
    setNegativePrompt(newNegativePrompt);
    updateScenePrompts(prompt, newNegativePrompt);
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
  const handleDeleteScene = (index) => {
    window.electron.ipcRenderer.invoke('delete-scene', filePath, index + 1)
      .then((updatedProjectData) => {
        if (updatedProjectData) {
          setDeletingScenes((prev) => new Set(prev).add(index + 1));
          if (sceneRefs.current[index + 1]) {
            sceneRefs.current[index + 1].style.width = '0px';
            sceneRefs.current[index + 1].style.height = '0px';
            sceneRefs.current[index + 1].style.opacity = '0';
            sceneRefs.current[index + 1].style.margin = '0';
            sceneRefs.current[index + 1].style.padding = '0';
          }
          setTimeout(() => {
            setProjectData(updatedProjectData);
            setVoiceText('');
            if (index + 1 <= selectedScene) {
              setSelectedScene(Math.max(1, selectedScene - 1));
            }
            setDeletingScenes((prev) => {
              const newSet = new Set(prev);
              newSet.delete(index + 1);
              return newSet;
            });
          }, 300);
        }
      })
      .catch((error) => console.error('Failed to delete scene:', error));
  };

  const handleOpenFolder = (sceneIndex) => {
    window.electron.ipcRenderer.invoke('open-scene-folder', filePath, sceneIndex)
      .catch((error) => console.error('Failed to open scene folder:', error));
  };

  // ---------- Fonts ----------
  useEffect(() => {
    setSelectedScene(2);
    const fetchFonts = async () => {
      try {
        const fonts = await window.electron.ipcRenderer.invoke('get-system-fonts');
        setAvailableFonts(fonts);
        const arialFont = fonts.find((font) => font.name.toLowerCase() === 'arial');
        if (arialFont) {
          setCaptionSettings((prev) => ({ ...prev, selectedFont: 'Arial' }));
          updateAvailableWeights(arialFont);
        } else if (fonts.length > 0) {
          setCaptionSettings((prev) => ({ ...prev, selectedFont: fonts[0].name }));
          updateAvailableWeights(fonts[0]);
        }
      } catch (error) {
        console.error('Error fetching fonts:', error);
      }
    };
    fetchFonts();
  }, []);

  const updateAvailableWeights = useCallback((font) => {
    const weights = font.weights.map((w) => ({ value: w.toString(), label: weightToLabel(w) }));
    setAvailableWeights(weights);
    const boldWeight = weights.find((w) => w.value === '700');
    if (boldWeight) {
      setCaptionSettings((prev) => ({ ...prev, selectedWeight: '700' }));
    } else {
      setCaptionSettings((prev) => ({ ...prev, selectedWeight: weights[0].value }));
    }
  }, []);

  const handleFontChange = useCallback((event) => {
    const newFont = event.target.value;
    updateCaptionSettings({ selectedFont: newFont });
    const font = availableFonts.find((f) => f.name === newFont);
    if (font) updateAvailableWeights(font);
  }, [availableFonts, updateCaptionSettings, updateAvailableWeights]);

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

  // ---------- Models ----------
  useEffect(() => {
    fetchBaseModels();
    fetchLoraModules();
  }, []);

  const fetchBaseModels = useCallback(async () => {
    try {
      const models = await window.electron.ipcRenderer.invoke('get-base-models');
      setBaseModels(models);
    } catch (error) {
      console.error('Failed to fetch base models:', error);
    }
  }, []);

  const fetchLoraModules = useCallback(async () => {
    try {
      const modules = await window.electron.ipcRenderer.invoke('get-lora-modules');
      setLoraModules(modules);
    } catch (error) {
      console.error('Failed to fetch LoRA modules:', error);
    }
  }, []);

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
  useEffect(() => { loadVoices(); }, []);

  const loadVoices = async () => {
    try {
      const voiceFiles = await window.electron.ipcRenderer.invoke('get-voices');
      setVoices(voiceFiles);
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  };

  const handleAddVoice = async () => {
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
      if (projectData && projectData.scenes[selectedScene - 1]) {
        const scene = projectData.scenes[selectedScene - 1];
        const mp4Path = `${filePath.split('/project.kodan')[0]}/Clips/${selectedScene}.mp4`;
        const pngPath = scene.thumbnail;
        const mp4Exists = await window.electron.ipcRenderer.invoke('check-file-exists', mp4Path);
        const pngExists = await window.electron.ipcRenderer.invoke('check-file-exists', pngPath);
        setCanExportClip(mp4Exists || pngExists);
      }
    };
    checkExportability();
  }, [projectData, selectedScene, filePath]);

  const handleExportClip = async () => {
    if (!canExportClip) return;
    const scene = projectData.scenes[selectedScene - 1];
    const mp4Path = `${filePath.split('/project.kodan')[0]}/Clips/${selectedScene}.mp4`;
    const pngPath = scene.thumbnail;
    try {
      const exportPath = await window.electron.ipcRenderer.invoke('export-clip', mp4Path, pngPath, selectedScene);
      if (exportPath) console.log(`Clip exported successfully to: ${exportPath}`);
    } catch (error) {
      console.error('Failed to export clip:', error);
    }
  };

  const handleExportProject = () => {
    window.electron.ipcRenderer.invoke('render-project', filePath.split('/project.kodan')[0])
      .then(() => console.log('Rendering completed and opened in Finder.'))
      .catch((error) => console.error('Error rendering project:', error));
  };

  // ---------- Thumbnail freshness polling ----------
  useInterval(() => {
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
    prompt === '' || currentlyLoading.includes(selectedScene) || (baseModels.length === 0 && loraModules.length === 0);

  return (
    <EditorLayout
      onExport={handleExportProject}
      leftSidebarProps={{
        baseModel,
        baseModels,
        onBaseModelChange: handleBaseModelChange,
        onBaseModelOpen: fetchBaseModels,
        selectedLora,
        loraModules,
        onLoraChange: handleLoraChange,
        onLoraOpen: fetchLoraModules,
        prompt,
        negativePrompt,
        onPromptChange: handlePromptChange,
        onNegativePromptChange: handleNegativePromptChange,
        isTransitioning,
        sceneDuration,
        generateLabel: generateImageText[selectedScene] || 'Generate Visuals',
        generateDisabled,
        onGenerate: () => startGenerationForScene(selectedScene),
      }}
      centerStageProps={{
        aspectRatio,
        scenePreviewProps: {
          thumbnail,
          videoKey,
          isLoading: currentlyLoading.includes(selectedScene),
          progress: progressMap[selectedScene],
          fact: currentFact,
          prompt,
          negativePrompt,
          onPromptChange: handlePromptChange,
          onNegativePromptChange: handleNegativePromptChange,
          generateDisabled: prompt === '' || (baseModels.length === 0 && loraModules.length === 0),
          onGenerate: () => startGenerationForScene(selectedScene),
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
        aspectRatio,
        canExportClip,
        sceneRefs,
        onSceneMouseDown: (sceneNumber) => {
          setPressedScene(sceneNumber);
          setIsMouseDown(true);
        },
        onSceneMouseUp: (sceneNumber) => {
          setIsMouseDown(false);
          if (pressedScene === sceneNumber) setSelectedScene(sceneNumber);
          setPressedScene(null);
        },
        onSceneMouseLeave: () => {
          if (isMouseDown) {
            setIsMouseDown(false);
            setPressedScene(null);
          }
        },
        onDeleteScene: handleDeleteScene,
        onOpenFolder: handleOpenFolder,
        pressedAddScene,
        onAddSceneMouseDown: () => setPressedAddScene(true),
        onAddSceneMouseUp: () => {
          setPressedAddScene(false);
          addNewScene();
        },
        onAddSceneMouseLeave: () => setPressedAddScene(false),
      }}
    />
  );
};

export default ProjectComponent;
