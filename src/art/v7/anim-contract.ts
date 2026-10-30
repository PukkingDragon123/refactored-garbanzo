// V11 contract: animation names other modules may ask the V7 cast for. The cast / Aroha / hands
// modules add these to ANIMS7 (src/art/v7/anims7.ts); callers check hasAnim7 and fall back.
import { ANIMS7 } from './anims7';

/** Aroha's (and Mori's slingshot) combat set */
export const COMBAT_ANIMS = ['slingReady', 'slingDraw', 'slingRelease', 'grenadeThrow', 'flipBack', 'dashStrike', 'roll', 'landCrouch', 'vault', 'dodge'] as const;
/** handling real objects */
export const HANDS_ANIMS = ['carryIdle', 'carryWalk', 'cupWater', 'cupWalk', 'backpackOff', 'backpackOn', 'kneelWork', 'craft', 'stir', 'chop'] as const;

/**
 * V12: Mori's moments (src/art/v7/anims-acts.ts, anims7.ts). Play them on his Actor by name:
 *  growl          his stomach growls: a lurch, both hands to his belly, a look down at it, then an
 *                 embarrassed glance out and a hand behind his head (one-shot, 1.8 s; also react('growl'))
 *  inspectFace    turning square to the viewer to present his gear (one-shot; ends in `inspect`)
 *  inspect        standing for inspection, square to the viewer, arms a little out (loop). setAnim('inspect')
 *                 plays inspectFace first by itself, and setAnim('idle') turns back (inspectBack)
 *  inspectCamera / inspectPack / inspectNote   the picked thing presented (loops, from `inspect`):
 *                 the camera lifted off his chest in both hands, thumbs hooked in the pack straps, a pat
 *                 on the pocket the note paper lives in
 *  cameraRaise / cameraLower   the camera up to the eye and down again (one-shots; the player's camera
 *                 mode plays the same through its transitions)
 *  pullNote / putNote   the note paper out of his pocket and opened in both hands / folded and put back
 *                 (one-shots; setAnim('noteRead') plays pullNote by itself, setAnim('idle') putNote)
 *  noteRead       reading it, held open at his chest (loop)
 * On the player: set Player.poseOverride (the player otherwise picks idle / walk every frame).
 */
export const V12_ANIMS = ['growl', 'inspectFace', 'inspect', 'inspectBack', 'inspectCamera', 'inspectPack', 'inspectNote', 'cameraRaise', 'cameraLower', 'pullNote', 'putNote', 'noteRead'] as const;

/**
 * Talking body language (src/art/v7/anims-talk.ts), one clip per floating-text style. The Actor picks
 * it from its talk style while the character talks, laid over the stance with a short crossfade in and
 * out (Actor.talkStyle / setTalkStyle(style), speaker.talk(on, style), or speaker.react({ react: style })):
 *   say → talk, shout → talkShout, whisper → talkWhisper, scared → talkScared, happy → talkHappy,
 *   laugh → laugh, sad → talkSad, think → think   (radio, notice: talk)
 */
export const TALK_ANIMS = ['talk', 'talkShout', 'talkWhisper', 'talkScared', 'talkHappy', 'laugh', 'talkSad', 'think'] as const;

/**
 * Reactions (anims-acts.ts): Actor.react(kind) lays them over the stance with anticipation, action and
 * recovery (jump → reactHop, bounce → reactBounce, recoil → reactRecoil, nod → reactNod, shrink →
 * reactCringe, tremble → reactTremble while it lasts); react(<any clip name>) plays that clip once
 * over the stance the same way (react('growl'), react('shrug'), react('surprised')).
 */
export const REACT_ANIMS = ['reactHop', 'reactBounce', 'reactRecoil', 'reactNod', 'reactCringe', 'reactTremble'] as const;

/**
 * Locomotion: walk (distance-driven), jog (a cutscene hurry: walkTo picks it for speeds over 85),
 * walkStart (idle → walk, by itself), walkStop / runStop (→ idle, by themselves, from the stride the
 * feet were in), turn (played over the stance or the walk whenever the facing flips).
 * Idle life: idleShift, idleLook and each one's own fidgets (fidgetStrap, fidgetHair, fidgetBeard...)
 * play by themselves now and then while someone stands about (Actor.fidget = false stops them).
 * Looking: Actor.lookAt(actorOrPoint, { face }) turns the head (up, down, back over the shoulder).
 */
export const MOVE_ANIMS = ['walk', 'jog', 'walkStart', 'walkStop', 'runStop', 'turn'] as const;

export function hasAnim7(anim: string): boolean { return !!ANIMS7[anim]; }
