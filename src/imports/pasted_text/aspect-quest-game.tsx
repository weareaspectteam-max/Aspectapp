Create a complete retro 2D platformer web game for a brand called ASPECT.

The game should be inspired by classic Mario-style platformers, but it must be original, modern, and themed around photography, media, and visual production.

TECH STACK:
- React + TypeScript
- HTML5 Canvas
- requestAnimationFrame game loop
- Single playable React component named AspectQuest.tsx
- Must work on both desktop and mobile
- Keyboard controls on desktop
- Touch controls on mobile
- Responsive layout
- Clean component structure and readable code

GAME OVERVIEW:
Build a fully playable 2D side-scrolling platformer with 5 different levels.
The player is a photographer hero from the ASPECT world.
He runs, jumps, double-jumps, and uses a camera action for special bonus interactions.

CORE PLAYER MECHANICS:
- run left/right
- jump
- double jump
- camera action button
- collect items
- avoid enemies and hazards
- reach end-of-level checkpoint
- 3 lives system
- smooth gravity and platform physics
- fair collision detection

GAME IDENTITY:
This is not a generic Mario clone.
It must feel like a branded ASPECT game with a photography/media universe.

PLAYER CHARACTER:
- pixel-art style photographer character
- small camera in hand
- backpack or gear bag
- run animation
- jump animation
- camera-action animation
- death / hit animation

COLLECTIBLES:
Replace coins with photography-themed items:
- photo frames
- camera lenses
- memory cards
- flash batteries
- special golden camera icons for bonus score

SPECIAL GAME MECHANIC:
Add “Photo Moments”.
At certain scripted or random moments, a visual target or flash icon appears.
If the player presses the camera action at the correct time:
- gains bonus points
- combo multiplier increases
- short slow-motion effect happens
- an on-screen photography tip or praise appears

SCORING:
Score should come from:
- collectibles
- defeated or avoided hazards
- successful photo moments
- combo streaks
- level completion bonus
- remaining lives bonus
- time bonus

HUD:
Display at top:
- score
- lives
- current level
- timer
- combo
- collected items

LEVEL STRUCTURE:
Create 5 unique levels, each with a distinct visual theme and gameplay identity.

LEVEL 1: GOLDEN HOUR BEACH
- warm sunset colors
- beach platforms
- wooden crates
- seagulls
- soft easy introduction
- teach movement and jump basics

LEVEL 2: NIGHT CITY STREETS
- dark city skyline
- neon signs
- moving hazards
- rooftop jumps
- more vertical platforming
- difficulty increases slightly

LEVEL 3: FESTIVAL STAGE
- concert lights
- speakers and stage platforms
- flashing lights
- moving platform sections
- more collectibles
- faster pacing

LEVEL 4: STORM HARBOR
- rain and wind effects
- slippery-looking surfaces
- waves splashing
- falling cargo boxes
- tougher hazards
- stronger atmosphere

LEVEL 5: RETRO ASPECT WORLD
- pixel-art celebration world
- mixed mechanics from earlier levels
- hardest challenge
- final finish gate
- highest score potential
- boss-like final sequence or survival segment before finish

LEVEL DESIGN REQUIREMENTS:
- each level should last around 1.5 to 3 minutes
- each level must have a start zone, mid challenge, and finish zone
- include platforms, gaps, hazards, moving objects, and collectibles
- include checkpoints
- difficulty should gradually increase
- level transitions should feel rewarding

ENEMIES / HAZARDS:
Do not copy Mario enemies directly.
Use original photography/media-themed hazards such as:
- flying birds
- falling equipment boxes
- rolling cases
- flashing light bursts
- water splashes
- unstable platform edges
- moving carts
- drone-like flying obstacles

VISUAL STYLE:
- retro pixel art look
- crisp canvas rendering
- image smoothing disabled where appropriate
- modern UI overlay
- premium dark interface outside the game canvas
- ASPECT-inspired identity
- gold / amber / dark tones in menus and HUD
- subtle glow effects
- clean game start screen and level complete screens

AUDIO SYSTEM:
Add simple audio support structure:
- jump sound
- collect sound
- hit sound
- level complete sound
- game over sound
Use placeholders if real assets are not included.

MENU SYSTEM:
Create:
- Start Screen
- Level Select screen
- Pause menu
- Game Over screen
- Level Complete screen
- Final Victory screen

LEADERBOARD:
Include a leaderboard system with top 10 scores.
For now, use mock local storage persistence.
Each score entry should store:
- player name
- total score
- level reached
- date

SAVE SYSTEM:
Use localStorage to save:
- unlocked levels
- best scores
- sound on/off
- last selected player name

CONTROLS:
Desktop:
- Arrow keys or A/D to move
- Space to jump
- Shift or E for camera action
- Esc for pause

Mobile:
- left/right touch buttons
- jump button
- camera action button
- pause button
Buttons should be large and comfortable for one-hand or two-thumb play.

PERFORMANCE REQUIREMENTS:
- smooth gameplay
- optimized render loop
- useRef for mutable game state
- avoid unnecessary React re-renders
- object pooling for repeated obstacles if useful
- clean cleanup for animation frame and input listeners

CANVAS:
- responsive canvas
- max width around 480 to 900 depending on layout
- maintain aspect ratio
- support modern mobile screens

CODE ORGANIZATION:
The code should be well structured and easy to maintain.
Suggested sections:
- types
- constants
- level definitions
- input system
- player physics
- collision system
- camera / scrolling system
- rendering
- UI screens
- score system
- save/load localStorage functions

IMPORTANT:
- Make the game fully playable
- Include all 5 levels
- Do not leave placeholder comments for major systems
- Write real game logic
- Use original art drawn with canvas primitives or simple shapes if no sprite assets are available
- Focus on gameplay first, polish second
- The result should feel like a real branded mini platformer, not a toy demo

OUTPUT:
Return the complete code for AspectQuest.tsx and any helper files if needed.
If helper files are used, clearly separate them.
The result must run as a real playable 5-level platformer in a React app.