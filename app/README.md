# Kōdan Anime Studio

Electron + React desktop app for generating anime scenes (image, voice, caption)
from prompts and stitching them into a project.

## Entry points

| Window           | HTML template                  | React entry           | Root component                                    |
| ---------------- | ------------------------------ | --------------------- | ------------------------------------------------- |
| Projects browser | `public/index.html`            | `src/index.js`        | `src/App.js`                                      |
| Project editor   | `public/project-viewer.html`   | `src/projectViewer.js`| `src/components/editor/ProjectComponent.js`       |
| Create modal     | `public/modal.html`            | _(static)_            | —                                                 |
| Manage models    | `public/manage.html`           | _(static)_            | —                                                 |

The Electron main process (`main/main.js`) handles IPC for file system access,
model invocation (`run_model.py`, `voice.py`, `generate_caption.py`,
`renderClip.py`, `renderProject.py`) and window management.

## Component layout

UI components live under `src/components/`, grouped by which window they belong
to. The editor is split by screen region so each file has one obvious purpose.

```
src/
├── App.js                            ← Projects browser controller
├── index.js                          ← Projects browser entry
├── projectViewer.js                  ← Project editor entry
├── data/
│   └── animeFacts.json               ← Loading-screen fun facts
└── components/
    ├── projects/                     ─── PROJECTS BROWSER ───
    │   ├── NoFolderView.js              Welcome / pick-folder screen
    │   ├── FolderView.js                Header + grid of projects
    │   └── ProjectCard.js               One project tile
    │
    └── editor/                       ─── PROJECT EDITOR ───
        ├── ProjectComponent.js          Top-level controller (state + handlers)
        ├── EditorLayout.js              Main editor mode: title + columns + bottom bar
        ├── ComposeLayout.js             Compose mode: title + composer + characters
        ├── TitleBar.js                  macOS traffic lights + Export button
        │
        ├── sidebars/                    ─── LEFT + RIGHT COLUMNS ───
        │   ├── LeftSidebar.js              Style + Prompt + Duration + Generate
        │   ├── StyleSection.js                Base model + LoRA dropdowns
        │   ├── PromptSection.js               Positive + negative prompt textareas
        │   ├── DurationSection.js             Read-only clip length
        │   ├── GenerateVisualsButton.js       Bottom CTA in left sidebar
        │   ├── RightSidebar.js             Caption + Stroke + Export Clip
        │   ├── CaptionSection.js              Font/weight/size/color + caption text
        │   ├── CaptionStrokeSection.js        Stroke width + color
        │   ├── ColorPickerField.js            Reusable swatch + native picker
        │   └── ExportClipSection.js           "Export Clip" CTA
        │
        ├── stage/                       ─── CENTER PREVIEW AREA ───
        │   ├── CenterStage.js              Wraps ScenePreview + VoiceLineBar
        │   ├── ScenePreview.js             Image / video / placeholder switch
        │   ├── ScenePlaceholder.js         Empty state + inline generate
        │   └── VoiceLineBar.js             Voiceline input + speaker + generate
        │
        ├── bottomBar/                   ─── SCENE STRIP ALONG THE BOTTOM ───
        │   ├── ScenesStrip.js              Horizontally-scrolling list
        │   ├── SceneThumbnail.js           One scene tile (with delete + folder)
        │   └── AddSceneButton.js           Trailing "+" tile
        │
        ├── compose/                     ─── COMPOSE-MODE BODY ───
        │   ├── StoryComposer.js            Story textarea + enriched panel
        │   ├── CharactersStrip.js          Row of generated character cards
        │   └── CharacterCard.js            One character card
        │
        └── shared/                      ─── EDITOR-WIDE PRIMITIVES ───
            ├── SectionHeader.js            Icon + label heading row
            ├── FieldLabel.js               Tiny uppercase form label
            └── Divider.js                  1px horizontal rule
```

### Where do I edit X?

| I want to change…                          | File                                                |
| ------------------------------------------ | --------------------------------------------------- |
| The traffic lights / Export button         | `editor/TitleBar.js`                                |
| The base model / LoRA dropdowns            | `editor/sidebars/StyleSection.js`                   |
| The positive / negative prompt boxes       | `editor/sidebars/PromptSection.js`                  |
| The “Generate Visuals” button              | `editor/sidebars/GenerateVisualsButton.js`          |
| The font / size / color caption controls   | `editor/sidebars/CaptionSection.js`                 |
| The color swatch + native picker UI        | `editor/sidebars/ColorPickerField.js`               |
| The big preview (image / video / empty)    | `editor/stage/ScenePreview.js` + `ScenePlaceholder` |
| The voiceline input + speaker + button     | `editor/stage/VoiceLineBar.js`                      |
| The horizontal scene strip                 | `editor/bottomBar/ScenesStrip.js`                   |
| One scene tile’s look or buttons           | `editor/bottomBar/SceneThumbnail.js`                |
| The + tile                                 | `editor/bottomBar/AddSceneButton.js`                |
| Story-compose textarea                     | `editor/compose/StoryComposer.js`                   |
| Character cards row                        | `editor/compose/CharactersStrip.js`                 |
| Project grid + “Create Anime” header       | `components/projects/FolderView.js`                 |
| One project card on the home screen        | `components/projects/ProjectCard.js`                |
| State / IPC / generation flow              | `editor/ProjectComponent.js`                        |

State, effects, IPC handlers, and debounced persistence all live in
`ProjectComponent.js` — every component below it is presentational and receives
data + callbacks via props. To add a new editor field, add the state in
`ProjectComponent.js`, then pass it down through the relevant `*Layout`/`*Sidebar`/
`*Stage` props.
# serenidad-desktop
