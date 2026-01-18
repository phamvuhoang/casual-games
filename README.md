# casual-games

Six browser-based AR experiments that run in a webcam tab—each leverages MediaPipe Hands for gesture tracking, with most using Three.js for rendering to keep your hands at the center of the fun.

## ar-starbridge-express
`ar-starbridge-express/starbridge-express.html` is a calm track-drawing sandbox that turns a pinched finger path into glowing rails on your desk. Confirm each line to sync it into the isometric relay yard, where tiny trains loop between the AR outer world and the city slice. Run the isometric city view at `http://localhost:3000/starbridge-express` to see the bridge, then allow camera access, pinch to draw, release to pause, and confirm to send the track across.

## ar-gesture-shooting
The `gesture-shooting.html` experience is a sci-fi shooter: MediaPipe tracks a pistol-like hand pose, a floating crosshair follows your index finger, and pinching with the thumb fires projectiles at 3D targets that spawn in front of you. The HUD shows your score, aim assist kicks in near enemies, and synth-style audio cues reinforce every hit or miss. Allow camera access, raise your hand, and aim with index/trigger with thumb to keep the score climbing.

## ar-ninja-fruit
`ninja-fruit.html` is the “Dual Blade Edition” fruit-slicing dojo. Two hand cursors trace your motions, combo text pulses for consecutive slices, and you can pinch to trigger slow-motion or clench a fist once the ultimate meter is full. Classic (60s) and endless survival modes are available, bombs punish sloppy swings, and neon HUD elements display score, timer, statuses, and lives. Open the file in a secure context, grant camera rights, then slice through orbs to rack up combos and keep the meter charged.

## ar-meteor-blaster
`ar-meteor-blaster/meteor-blaster.html` throws you into a neon defense grid where a finger-gun pose aims lasers at incoming meteors, bombs, and rare power-ups floating in a 3D cityscape. Hold the gesture to overcharge your shot, uncross and spread your hands to trigger a NOVA ultimate, and show an open palm to pause the mission; score, shield, and ultimate meters keep you honest as the swarm grows harder. Allow camera access, steady your aim, and keep the city shielded from impact to climb the leaderboard.

## ar-balloon-pop-carnival
`ar-balloon-pop-carnival/balloon-pop-carnival.html` is a time-limited carnival run where index fingers poke the balloons and pinches launch darts. A combo meter rewards rapid pops, a mega meter charges up for bonus fireworks, and a countdown timer keeps the pressure high. Grant webcam access, keep your hands visible, and burst as many balloons as you can before the clock runs out.

## ar-anime-skills
`ar-anime-skills/anime-skills.html` is a two-skill dojo that alternates between Spirit Gun finger-gun hits and Kamehameha-style wrist coordination. Score points by extending your index to fire a cyan beam, then switch to charging both wrists together to unleash a blue energy wave once you push them apart. The HUD highlights score and timer, a mirrored webcam feed keeps the gestures readable, and the sequence resets automatically after each success—allow camera access and keep hands centered to land every anime punchline.
