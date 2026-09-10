import { useRef, useCallback, useMemo } from 'react';

// ── Keypoint indices (MoveNet) ────────────────────────
const KP = {
  NOSE: 0, LEFT_EYE: 1, RIGHT_EYE: 2, LEFT_EAR: 3, RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,     RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,     RIGHT_WRIST: 10,
  LEFT_HIP: 11,      RIGHT_HIP: 12,
  LEFT_KNEE: 13,     RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,    RIGHT_ANKLE: 16,
};

const CONNECTIONS = [
  [KP.NOSE, KP.LEFT_SHOULDER], [KP.NOSE, KP.RIGHT_SHOULDER],
  [KP.LEFT_SHOULDER,  KP.RIGHT_SHOULDER],
  [KP.LEFT_SHOULDER,  KP.LEFT_ELBOW],   [KP.LEFT_ELBOW,  KP.LEFT_WRIST],
  [KP.RIGHT_SHOULDER, KP.RIGHT_ELBOW],  [KP.RIGHT_ELBOW, KP.RIGHT_WRIST],
  [KP.LEFT_SHOULDER,  KP.LEFT_HIP],     [KP.RIGHT_SHOULDER, KP.RIGHT_HIP],
  [KP.LEFT_HIP,  KP.RIGHT_HIP],
  [KP.LEFT_HIP,  KP.LEFT_KNEE],  [KP.LEFT_KNEE,  KP.LEFT_ANKLE],
  [KP.RIGHT_HIP, KP.RIGHT_KNEE], [KP.RIGHT_KNEE, KP.RIGHT_ANKLE],
];

// ── Combos ────────────────────────────────────────────
export const COMBOS = [
  { name: 'ONE-TWO-THREE-TWO', seq: ['jab','cross','hook','cross'], label: '1-2-3-2' },
  { name: 'ONE-TWO-THREE',     seq: ['jab','cross','hook'],         label: '1-2-3'   },
  { name: 'ONE-TWO',           seq: ['jab','cross'],                label: '1-2'     },
  { name: 'DOUBLE JAB CROSS',  seq: ['jab','jab','cross'],          label: '1-1-2'   },
  { name: 'DOUBLE JAB',        seq: ['jab','jab'],                  label: '1-1'     },
  { name: 'HOOK CROSS',        seq: ['hook','cross'],               label: '3-2'     },
  { name: 'UPPERCUT HOOK',     seq: ['uppercut','hook'],            label: 'U-3'     },
  { name: 'BODY COMBO',        seq: ['hook','uppercut','cross'],    label: '3-U-2'   },
];

const COMBO_WINDOW_MS = 2500;
const PUNCH_COOLDOWN  = 700;
const PUNCH_THRESHOLD = 45; // px per 100ms
const DOMINANCE_RATIO = 1.6;

function kp(pose, idx) {
  const k = pose.keypoints[idx];
  return k?.score > 0.25 ? k : null;
}

function getAngle(a, b, c) {
  if (!a || !b || !c) return 120;
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot   = ab.x * cb.x + ab.y * cb.y;
  const denom = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  return (Math.acos(Math.max(-1, Math.min(1, dot / denom))) * 180) / Math.PI;
}

export function useBoxingEngine(stance = 'orthodox') {
  const wristHistoryRef  = useRef([]);
  const lastPunchTimeRef = useRef(0);
  const recentPunchesRef = useRef([]);

  // Kept in a ref so the memoised callbacks below never go stale on a change
  const stanceRef = useRef(stance);
  stanceRef.current = stance;

  // ── Guard score ──────────────────────────────────────
  const calcGuard = useCallback((pose, canvasHeight) => {
    const lWrist    = kp(pose, KP.LEFT_WRIST);
    const rWrist    = kp(pose, KP.RIGHT_WRIST);
    const lShoulder = kp(pose, KP.LEFT_SHOULDER);
    const rShoulder = kp(pose, KP.RIGHT_SHOULDER);
    const lHip      = kp(pose, KP.LEFT_HIP);
    const rHip      = kp(pose, KP.RIGHT_HIP);
    const nose      = kp(pose, KP.NOSE);

    if (!lWrist || !rWrist) return 0;

    if (lShoulder && rShoulder) {
      const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
      const bodySegment  = (lHip && rHip)
        ? Math.abs(((lHip.y + rHip.y) / 2) - shoulderMidY)
        : 120;
      const threshold = shoulderMidY + bodySegment * 0.4;
      return ((lWrist.y < threshold ? 50 : 0) + (rWrist.y < threshold ? 50 : 0));
    }

    if (nose) {
      const threshold = nose.y + (canvasHeight || 720) * 0.25;
      return ((lWrist.y < threshold ? 50 : 0) + (rWrist.y < threshold ? 50 : 0));
    }
    return 0;
  }, []);

  // ── Chin protection ──────────────────────────────────
  const calcChin = useCallback((pose) => {
    const lShoulder = kp(pose, KP.LEFT_SHOULDER);
    const rShoulder = kp(pose, KP.RIGHT_SHOULDER);
    const nose      = kp(pose, KP.NOSE);
    const lWrist    = kp(pose, KP.LEFT_WRIST);
    const rWrist    = kp(pose, KP.RIGHT_WRIST);

    if (!lShoulder || !rShoulder || !nose) return 0;
    const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
    let score = nose.y < shoulderMidY + 20 ? 80 : 40;
    if (lWrist && rWrist && lWrist.y < nose.y + 80 && rWrist.y < nose.y + 80)
      score = Math.min(100, score + 20);
    return score;
  }, []);

  // ── Shoulder rotation ────────────────────────────────
  const calcRotation = useCallback((pose) => {
    const lShoulder = kp(pose, KP.LEFT_SHOULDER);
    const rShoulder = kp(pose, KP.RIGHT_SHOULDER);
    if (!lShoulder || !rShoulder) return 0;
    const diff  = Math.abs(lShoulder.y - rShoulder.y);
    const width = Math.abs(lShoulder.x - rShoulder.x);
    const angle = Math.atan2(diff, width) * (180 / Math.PI);
    return Math.min(100, angle * 5);
  }, []);

  // ── Balance ──────────────────────────────────────────
  const calcBalance = useCallback((pose) => {
    const lAnkle = kp(pose, KP.LEFT_ANKLE);
    const rAnkle = kp(pose, KP.RIGHT_ANKLE);
    const lHip   = kp(pose, KP.LEFT_HIP);
    const rHip   = kp(pose, KP.RIGHT_HIP);

    if (!lAnkle || !rAnkle || !lHip || !rHip) return 50;
    const stanceWidth = Math.abs(lAnkle.x - rAnkle.x);
    const hipWidth    = Math.abs(lHip.x - rHip.x) || 1;
    const ratio = stanceWidth / hipWidth;
    if (ratio >= 1.0 && ratio <= 2.5) return 90;
    return ratio < 1.0 ? 40 : 60;
  }, []);

  // ── Punch detection ──────────────────────────────────
  const detectPunch = useCallback((pose) => {
    const lWrist    = kp(pose, KP.LEFT_WRIST);
    const rWrist    = kp(pose, KP.RIGHT_WRIST);
    const lShoulder = kp(pose, KP.LEFT_SHOULDER);
    const rShoulder = kp(pose, KP.RIGHT_SHOULDER);
    const lElbow    = kp(pose, KP.LEFT_ELBOW);
    const rElbow    = kp(pose, KP.RIGHT_ELBOW);

    if (!lWrist || !rWrist) return null;

    const now = Date.now();
    if (now - lastPunchTimeRef.current < PUNCH_COOLDOWN) return null;

    wristHistoryRef.current.push({ lx: lWrist.x, ly: lWrist.y, rx: rWrist.x, ry: rWrist.y, t: now });
    if (wristHistoryRef.current.length > 6) wristHistoryRef.current.shift();
    if (wristHistoryRef.current.length < 4) return null;

    const prev = wristHistoryRef.current[0];
    const curr = wristHistoryRef.current[wristHistoryRef.current.length - 1];
    const dt   = Math.max(curr.t - prev.t, 1);
    const scale = 100 / dt;

    const lSpeed = Math.hypot(curr.lx - prev.lx, curr.ly - prev.ly) * scale;
    const rSpeed = Math.hypot(curr.rx - prev.rx, curr.ry - prev.ry) * scale;

    if (lSpeed < PUNCH_THRESHOLD && rSpeed < PUNCH_THRESHOLD) return null;

    const leftDom  = lSpeed > rSpeed * DOMINANCE_RATIO && lSpeed > PUNCH_THRESHOLD;
    const rightDom = rSpeed > lSpeed * DOMINANCE_RATIO && rSpeed > PUNCH_THRESHOLD;
    if (!leftDom && !rightDom) return null;

    // The lead hand throws the jab, the rear hand the cross. Orthodox leads
    // with the left, southpaw with the right.
    const leadSide = stanceRef.current === 'southpaw' ? 'right' : 'left';
    const side     = leftDom ? 'left' : 'right';

    const velX = leftDom ? curr.lx - prev.lx : curr.rx - prev.rx;
    const velY = leftDom ? curr.ly - prev.ly : curr.ry - prev.ry;
    const armAngle = leftDom
      ? getAngle(lShoulder, lElbow, lWrist)
      : getAngle(rShoulder, rElbow, rWrist);

    let punch = null;
    if (Math.abs(velX) > Math.abs(velY) * 0.6) {
      punch = armAngle > 145 ? (side === leadSide ? 'jab' : 'cross') : 'hook';
    } else if (velY < 0 && Math.abs(velY) > Math.abs(velX) * 0.6) {
      punch = 'uppercut';
    }

    if (punch) lastPunchTimeRef.current = now;
    return punch;
  }, []);

  // ── Combo detection ──────────────────────────────────
  const detectCombo = useCallback((punch) => {
    const now = Date.now();
    recentPunchesRef.current.push({ type: punch, ts: now });
    recentPunchesRef.current = recentPunchesRef.current.filter(p => now - p.ts < COMBO_WINDOW_MS);
    const seq = recentPunchesRef.current.map(p => p.type);

    for (const combo of COMBOS) {
      const cl = combo.seq.length;
      if (seq.length >= cl && seq.slice(-cl).every((p, i) => p === combo.seq[i])) {
        recentPunchesRef.current = [];
        return combo;
      }
    }
    return null;
  }, []);

  // ── Skeleton drawing ─────────────────────────────────
  const drawPose = useCallback((pose, ctx, canvas) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth    = 2;
    ctx.strokeStyle  = 'rgba(224, 31, 31, 0.75)';
    ctx.shadowColor  = '#e01f1f';
    ctx.shadowBlur   = 6;

    for (const [a, b] of CONNECTIONS) {
      const ka = kp(pose, a), kb = kp(pose, b);
      if (ka && kb) {
        ctx.beginPath();
        ctx.moveTo(ka.x, ka.y);
        ctx.lineTo(kb.x, kb.y);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 10;
    for (const k of pose.keypoints) {
      if (k.score > 0.25) {
        const isWrist = k.name?.includes('wrist');
        ctx.beginPath();
        ctx.arc(k.x, k.y, isWrist ? 7 : 4, 0, Math.PI * 2);
        ctx.fillStyle  = isWrist ? '#c9a84c' : 'rgba(255,255,255,0.85)';
        ctx.shadowColor = isWrist ? '#c9a84c' : '#fff';
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }, []);

  // ── Activity level ───────────────────────────────────
  const calcActivity = useCallback((pose, prevPose) => {
    if (!prevPose) return 0;
    const lw  = kp(pose, KP.LEFT_WRIST),  rw  = kp(pose, KP.RIGHT_WRIST);
    const plw = kp(prevPose, KP.LEFT_WRIST), prw = kp(prevPose, KP.RIGHT_WRIST);
    if (!lw || !rw || !plw || !prw) return 0;
    const lDelta = Math.hypot(lw.x - plw.x, lw.y - plw.y);
    const rDelta = Math.hypot(rw.x - prw.x, rw.y - prw.y);
    return Math.min(100, Math.round(((lDelta + rDelta) / 2) * 3));
  }, []);

  const resetHistory = useCallback(() => {
    wristHistoryRef.current  = [];
    lastPunchTimeRef.current = 0;
    recentPunchesRef.current = [];
  }, []);

  // Memoised so consumers can hold the whole engine in an effect dependency
  // list without it invalidating on every render
  return useMemo(
    () => ({ calcGuard, calcChin, calcRotation, calcBalance, detectPunch, detectCombo, drawPose, calcActivity, resetHistory }),
    [calcGuard, calcChin, calcRotation, calcBalance, detectPunch, detectCombo, drawPose, calcActivity, resetHistory]
  );
}
