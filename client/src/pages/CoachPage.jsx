import { useRef, useState, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { useBoxingEngine } from '../hooks/useBoxingEngine';
import { useSpeech } from '../hooks/useSpeech';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Lazy load pose detection to avoid import issues
let poseDetectionModule = null;

async function getPoseDetection() {
  if (poseDetectionModule) return poseDetectionModule;
  try {
    // Import with extended timeout for large model files
    const poseDetection = await import('@tensorflow-models/pose-detection');
    poseDetectionModule = poseDetection;
    return poseDetectionModule;
  } catch (err) {
    console.error('Failed to load pose detection:', err);
    throw err;
  }
}

const FEEDBACK_TIPS = {
  jab:      ["Snap the jab back — don't hang.", "Keep your rear hand on your cheek.", "Step into the jab for more reach."],
  cross:    ["Drive from the hip — rotate through.", "Reset your guard after the cross.", "Pivot your back foot for max power."],
  hook:     ["Hook on a horizontal plane, elbow at 90°.", "Rotate the whole torso, not just the arm.", "Step outside on lead hooks."],
  uppercut: ["Dip before the uppercut — load the spring.", "Drive up with your legs.", "Tuck your chin when going inside."],
};

const COMBO_TIPS = {
  'ONE-TWO':           'Stay balanced after the cross.',
  'ONE-TWO-THREE':     'Pivot on your back foot with that hook!',
  'ONE-TWO-THREE-TWO': 'Beautiful! Return to guard immediately.',
  'DOUBLE JAB':        'Vary the tempo on those jabs.',
  'DOUBLE JAB CROSS':  'Step in on the second jab.',
  'HOOK CROSS':        'Good inside work — exit clean.',
  'UPPERCUT HOOK':     'Drive with your legs on that uppercut.',
  'BODY COMBO':        'Mix up head and body levels!',
};

// A tip takes ~2.6s to speak but punches land every ~700ms, so tips are paced
// rather than spoken one-per-punch. The sidebar still logs every one.
const TIP_SPEECH_INTERVAL_MS = 5000;

function formatDur(s) { const m = Math.floor(s/60); return m ? `${m}m ${s%60}s` : `${s}s`; }

export default function CoachPage() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const detectorRef = useRef(null);
  const lastPoseRef = useRef(null);
  const frameRef  = useRef(0);

  // Session accumulators
  const statsRef  = useRef({ guardScore:0, chinScore:0, rotationScore:0, balanceScore:0, count:0 });
  const startTimeRef = useRef(null);
  const savedMsgsRef = useRef([]);
  const punchCountsRef = useRef({ jab:0, cross:0, hook:0, uppercut:0 });
  const comboCountsRef = useRef({});
  const lastGuardWarnRef = useRef(0);
  const feedbackIdxRef = useRef({});
  const lastTipSpeechRef = useRef(0);

  const [running,   setRunning]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [audioOn,   setAudioOn]   = useState(true);
  const [messages,  setMessages]  = useState([{ text: 'Start a session to begin.', tag: 'SYSTEM', type: 'system' }]);
  const [metrics,   setMetrics]   = useState({ guard:0, chin:0, rotation:0, balance:0, activity:0 });
  const [punches,   setPunches]   = useState({ jab:0, cross:0, hook:0, uppercut:0 });
  const [combos,    setCombos]    = useState({});
  const [moveFlash, setMoveFlash] = useState('');
  const [comboFlash,setComboFlash]= useState(null);
  const [saving,    setSaving]    = useState(false);

  const { user } = useAuth();
  const engine = useBoxingEngine(user?.stance);
  const { speak, setEnabled: setSpeechEnabled, hasVoices } = useSpeech();

  const addMsg = useCallback((text, tag='COACH', type='coach') => {
    setMessages(m => [...m.slice(-11), { text, tag, type, ts: Date.now() }]);
    savedMsgsRef.current.push({ text, tag, type, ts: Date.now() });
  }, []);

  const speakFeedback = useCallback((text, level = 'normal') => {
    const cleanText = String(text || '')
      .replace(/⚠️/g, '')
      .replace(/[^a-zA-Z0-9 ,.!?\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanText) speak(cleanText, level);
  }, [speak]);

  // Per-punch tips are the one channel that outruns speech — punches land every
  // ~700ms, a tip takes ~2.6s to say. Pacing them here is what keeps the queue
  // short enough that the AI coaching still gets through.
  const speakTip = useCallback((text) => {
    const now = Date.now();
    if (now - lastTipSpeechRef.current < TIP_SPEECH_INTERVAL_MS) return;
    lastTipSpeechRef.current = now;
    speakFeedback(text, 'normal');
  }, [speakFeedback]);

  const syncCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;
    if (!width || !height) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }, []);

  // ── Start session ─────────────────────────────────────
  const startSession = useCallback(async () => {
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      videoRef.current.srcObject = stream;
      await new Promise(r => { videoRef.current.onloadedmetadata = r; });
      await videoRef.current.play();
      syncCanvasSize();

      await tf.setBackend('webgl');
      await tf.ready();

      // Load pose detection
      const poseDetection = await getPoseDetection();

      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      detectorRef.current = detector;

      // Reset accumulators
      statsRef.current = { guardScore:0, chinScore:0, rotationScore:0, balanceScore:0, count:0 };
      punchCountsRef.current = { jab:0, cross:0, hook:0, uppercut:0 };
      comboCountsRef.current = {};
      savedMsgsRef.current = [];
      startTimeRef.current = Date.now();
      feedbackIdxRef.current = {};
      lastTipSpeechRef.current = 0;
      engine.resetHistory();

      setRunning(true);
      setMetrics({ guard:0, chin:0, rotation:0, balance:0, activity:0 });
      setPunches({ jab:0, cross:0, hook:0, uppercut:0 });
      setCombos({});
      addMsg('Session started! Throw some punches.', 'COACH');
      speak('Session started. Get in your stance and start throwing punches.');
    } catch (err) {
      console.error(err);
      addMsg('Camera or model failed. Allow camera access and retry.', 'SYSTEM', 'system');
    }
    setLoading(false);
  }, [engine, addMsg, speak, syncCanvasSize]);

  // ── Detection loop ────────────────────────────────────
  useEffect(() => {
    if (!running) return;

    // `loop` awaits mid-body, so a teardown can land while it is suspended.
    // This flag stops the resumed call from touching state or rescheduling.
    let cancelled = false;

    const loop = async () => {
      frameRef.current++;
      if (frameRef.current % 2 === 0 && detectorRef.current && videoRef.current) {
        try {
          const poses = await detectorRef.current.estimatePoses(videoRef.current);
          if (cancelled) return;
          if (poses.length > 0) {
            const pose = poses[0];
            const canvas = canvasRef.current;

            // Scores
            const guard    = engine.calcGuard(pose, canvas?.height);
            const chin     = engine.calcChin(pose);
            const rotation = engine.calcRotation(pose);
            const balance  = engine.calcBalance(pose);
            const activity = engine.calcActivity(pose, lastPoseRef.current);

            // Accumulate for session report
            statsRef.current.guardScore    += guard;
            statsRef.current.chinScore     += chin;
            statsRef.current.rotationScore += rotation;
            statsRef.current.balanceScore  += balance;
            statsRef.current.count++;

            setMetrics({ guard, chin, rotation, balance, activity });

            // Punch detection
            const punch = engine.detectPunch(pose);
            if (punch) {
              punchCountsRef.current[punch]++;
              setPunches({ ...punchCountsRef.current });

              setMoveFlash(punch.toUpperCase());
              setTimeout(() => setMoveFlash(''), 700);

              // Per-punch tip
              const tips = FEEDBACK_TIPS[punch];
              const idx  = feedbackIdxRef.current[punch] || 0;
              let msg = tips[idx % tips.length];
              feedbackIdxRef.current[punch] = idx + 1;
              if (guard < 40) msg += ' ⚠️ Hands up!';
              addMsg(msg, punch.toUpperCase() + ' TIP');
              speakTip(msg);

              // Combo detection
              const combo = engine.detectCombo(punch);
              if (combo) {
                comboCountsRef.current[combo.name] = (comboCountsRef.current[combo.name] || 0) + 1;
                setCombos({ ...comboCountsRef.current });
                setComboFlash(combo);
                setTimeout(() => setComboFlash(null), 900);
                const comboText = `${combo.name} (${combo.label}) — ${COMBO_TIPS[combo.name] || ''}`;
                // Say the name only — the coaching tip stays in the sidebar.
                // Announcing the full line took ~3.3s, long enough to crowd
                // out the per-punch tips and the AI coach.
                speakFeedback(combo.name.replace(/-/g, ' '), 'normal');
                addMsg(comboText, 'COMBO');
              }
            }

            // Guard voice warning
            const now = Date.now();
            if (guard < 40 && now - lastGuardWarnRef.current > 8000) {
              lastGuardWarnRef.current = now;
              speak('Hands up! Guard is low!', 'urgent');
            }

            // Draw skeleton
            if (canvas) engine.drawPose(pose, canvas.getContext('2d'), canvas);
            lastPoseRef.current = pose;
          } else {
            const canvas = canvasRef.current;
            if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch (_) {}
      }
      if (cancelled) return;
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [running, engine, addMsg, speak, speakFeedback, speakTip]);

  // Sync canvas size to video
  useEffect(() => {
    if (!running || !videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const sync = () => syncCanvasSize();

    if (v.readyState >= 2) sync();
    v.addEventListener('loadedmetadata', sync);
    v.addEventListener('loadeddata', sync);
    v.addEventListener('play', sync);

    const frame = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(frame);
      v.removeEventListener('loadedmetadata', sync);
      v.removeEventListener('loadeddata', sync);
      v.removeEventListener('play', sync);
    };
  }, [running, syncCanvasSize]);

  // ── End & save session ────────────────────────────────
  const endSession = useCallback(async () => {
    setRunning(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());

    const { count, ...sums } = statsRef.current;
    const n = count || 1;
    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);

    setSaving(true);
    try {
      // Ensure messages are properly formatted objects
      const messages = savedMsgsRef.current.slice(-50).map(msg => ({
        text: String(msg.text || ''),
        tag: String(msg.tag || 'COACH'),
        type: String(msg.type || 'coach'),
        ts: Number(msg.ts || Date.now())
      }));

      // Ensure punches and combos have correct structure
      const punches = {
        jab: Number(punchCountsRef.current.jab) || 0,
        cross: Number(punchCountsRef.current.cross) || 0,
        hook: Number(punchCountsRef.current.hook) || 0,
        uppercut: Number(punchCountsRef.current.uppercut) || 0,
      };

      const combos = {};
      for (const [key, val] of Object.entries(comboCountsRef.current)) {
        combos[key] = Number(val) || 0;
      }

      const payload = {
        durationSec: Number(durationSec),
        avgGuard:    Math.round(sums.guardScore    / n),
        avgChin:     Math.round(sums.chinScore     / n),
        avgRotation: Math.round(sums.rotationScore / n),
        avgBalance:  Math.round(sums.balanceScore  / n),
        punches,
        combos,
        messages,
      };

      console.log('Saving session with payload:', payload);
      
      const response = await api.post('/sessions', payload);
      console.log('Session saved successfully:', response.data);
      addMsg(`Session saved! ${Object.values(punches).reduce((a,b)=>a+b,0)} punches over ${formatDur(durationSec)}.`, 'SAVED', 'system');
      // Dispatch event to notify other pages that a session was saved
      window.dispatchEvent(new CustomEvent('sessionSaved'));
    } catch (err) {
      console.error('Full error object:', err);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      console.error('Error message:', err.message);
      addMsg('Session could not be saved. Check your connection.', 'ERROR', 'system');
    }
    setSaving(false);
  }, [addMsg]);

  // ── AI coaching request ───────────────────────────────
  const requestAICoach = useCallback(async () => {
    const n = statsRef.current.count || 1;
    try {
      const res = await api.post('/sessions/coaching', {
        avgGuard:    Math.round(statsRef.current.guardScore    / n),
        avgChin:     Math.round(statsRef.current.chinScore     / n),
        avgRotation: Math.round(statsRef.current.rotationScore / n),
        avgBalance:  Math.round(statsRef.current.balanceScore  / n),
        punches:     punchCountsRef.current,
        combos:      comboCountsRef.current,
      });
      addMsg(res.data.coaching, 'AI COACH');
      speak(res.data.coaching);
    } catch (err) {
      console.error('Coaching request failed:', err.response?.data || err.message);
      addMsg(err.response?.data?.message || 'AI coaching unavailable.', 'SYSTEM', 'system');
    }
  }, [addMsg, speak]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(requestAICoach, 30000);
    const t  = setTimeout(requestAICoach, 6000);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [running, requestAICoach]);

  const guardLabel = g => g > 70 ? ['GOOD','good'] : g > 40 ? ['LOW','warn'] : ['OPEN','bad'];
  const [gLabel, gClass] = guardLabel(metrics.guard);

  return (
    <div className="coach-layout" style={{ height:'100%', minHeight:0 }}>
      {/* ── VIDEO ── */}
      <div className="coach-video" style={{ position:'relative', background:'#000', overflow:'hidden' }}>
        <video ref={videoRef} autoPlay muted playsInline
          style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', display:'block' }} />
        <canvas ref={canvasRef}
          style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', transform:'scaleX(-1)', pointerEvents:'none' }} />

        {/* Corner brackets */}
        {['tl','tr','bl','br'].map(c => (
          <div key={c} style={{
            position:'absolute', width:28, height:28,
            borderColor:'var(--red)', borderStyle:'solid', opacity:0.8,
            ...(c==='tl'?{top:20,left:20,borderWidth:'2px 0 0 2px'}:{}),
            ...(c==='tr'?{top:20,right:20,borderWidth:'2px 2px 0 0'}:{}),
            ...(c==='bl'?{bottom:20,left:20,borderWidth:'0 0 2px 2px'}:{}),
            ...(c==='br'?{bottom:20,right:20,borderWidth:'0 2px 2px 0'}:{}),
          }} />
        ))}

        {/* HUD top */}
        <div style={{ position:'absolute', top:28, left:'50%', transform:'translateX(-50%)', fontFamily:'"Share Tech Mono"', fontSize:'0.65rem', color:'rgba(255,255,255,0.4)', letterSpacing:4 }}>
          {running ? 'ANALYZING FORM — SHADOW BOX FREELY' : 'AWAITING SESSION'}
        </div>

        {/* Punch flash */}
        {moveFlash && (
          <div style={{ position:'absolute', bottom:80, left:'50%', transform:'translateX(-50%)', fontFamily:'"Bebas Neue"', fontSize:'2.8rem', letterSpacing:8, color:'var(--red)', textShadow:'0 0 30px var(--red-glow)', textAlign:'center' }}>
            {moveFlash}
          </div>
        )}

        {/* Combo flash */}
        {comboFlash && (
          <div style={{ position:'absolute', top:'45%', left:'50%', transform:'translate(-50%,-50%)', fontFamily:'"Bebas Neue"', fontSize:'2.6rem', letterSpacing:8, color:'var(--gold)', textShadow:'0 0 40px rgba(201,168,76,0.7)', textAlign:'center', animation:'comboIn 0.8s ease forwards' }}>
            {comboFlash.name}
            <div style={{ fontSize:'0.9rem', letterSpacing:5, color:'rgba(201,168,76,0.6)' }}>{comboFlash.label}</div>
          </div>
        )}

        {/* Start prompt */}
        {!running && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.85)', zIndex:10 }}>
            <h2 style={{ fontFamily:'"Bebas Neue"', fontSize:'3.5rem', letterSpacing:10, color:'#fff', marginBottom:8 }}>CORNER</h2>
            <p style={{ color:'var(--dim)', fontSize:'1rem', letterSpacing:2, marginBottom:36 }}>YOUR AI BOXING COACH</p>
            <button className="btn-primary" onClick={startSession} disabled={loading}>
              {loading ? 'LOADING MODEL...' : 'STEP INTO THE RING'}
            </button>
          </div>
        )}

        {/* End session button */}
        {running && (
          <button onClick={endSession} disabled={saving} style={{
            position:'absolute', bottom:20, right:20,
            background:'var(--red)', color:'#fff', border:'none',
            fontFamily:'"Bebas Neue"', fontSize:'0.85rem', letterSpacing:3,
            padding:'8px 20px', cursor:'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'SAVING...' : '⏹ END SESSION'}
          </button>
        )}
      </div>

      {/* ── SIDEBAR ── */}
      <div className="coach-sidebar">
        {!hasVoices() && audioOn && (
          <div style={{ padding:'10px 20px', borderBottom:'1px solid rgba(255, 201, 52, 0.5)', background:'rgba(255, 201, 52, 0.08)', color:'#f9d77a', fontFamily:'"Share Tech Mono"', fontSize:'0.62rem', letterSpacing:'1.2px', lineHeight:1.5 }}>
            Voice unavailable: no system English voices are installed in this browser. Open in Chrome/Edge with macOS speech voices enabled.
          </div>
        )}

        {/* Audio toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px', borderBottom:'1px solid var(--border)', background:'#0d0d0d', flexShrink:0 }}>
          <span style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:3, color:'var(--dim)' }}>🔊 VOICE COACHING</span>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
            <span style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.65rem', color:'var(--dim)' }}>{audioOn?'ON':'OFF'}</span>
            <div onClick={() => { const next = !audioOn; setAudioOn(next); setSpeechEnabled(next); }}
              style={{ width:36, height:18, background: audioOn ? 'var(--red)' : 'var(--border)', borderRadius:9, position:'relative', cursor:'pointer', transition:'background 0.2s' }}>
              <div style={{ position:'absolute', top:2, left: audioOn ? 20 : 2, width:14, height:14, background: audioOn ? '#fff' : 'var(--dim)', borderRadius:'50%', transition:'left 0.2s' }} />
            </div>
          </label>
        </div>

        <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
          {/* Live metrics */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
            <div className="section-label">Live Metrics</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                ['Guard', gLabel, gClass],
                ['Stance', metrics.balance > 75 ? ['SOLID','good'] : metrics.balance > 45 ? ['ADJUST','warn'] : ['WEAK','bad']].flat(),
                ['Speed',  metrics.activity > 60 ? ['FAST','good'] : metrics.activity > 25 ? ['MED','warn'] : ['SLOW','']].flat(),
                ['Activity', [`${metrics.activity}%`, '']].flat(),
              ].map(([label, val, cls]) => (
                <div key={label} style={{ background:'#0d0d0d', border:'1px solid var(--border)', padding:'10px 12px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, width:2, height:'100%', background:'var(--red)', opacity:0.6 }} />
                  <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.58rem', letterSpacing:2, color:'var(--dim)', marginBottom:4 }}>{label}</div>
                  <div style={{ fontFamily:'"Bebas Neue"', fontSize:'1.7rem', lineHeight:1, color: cls==='good'?'var(--green)':cls==='warn'?'var(--gold)':cls==='bad'?'var(--red)':'#fff' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Form bars */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
            <div className="section-label">Form Analysis</div>
            {[['Guard Position', metrics.guard], ['Chin Protection', metrics.chin], ['Shoulder Rotation', metrics.rotation], ['Balance', metrics.balance]].map(([name, val]) => (
              <div key={name} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:'0.8rem', fontWeight:600, textTransform:'uppercase', letterSpacing:1 }}>{name}</span>
                  <span style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.75rem', color:'var(--gold)' }}>{Math.round(val)}%</span>
                </div>
                <div style={{ height:4, background:'var(--border)' }}>
                  <div style={{ height:'100%', width:`${val}%`, background:'linear-gradient(90deg,var(--red),var(--gold))', transition:'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Punch log */}
          <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
            <div className="section-label">Punches</div>
            {['jab','cross','hook','uppercut'].map(type => (
              <div key={type} style={{ display:'flex', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.65rem', letterSpacing:2, color:'var(--dim)', width:76, textTransform:'uppercase' }}>{type}</span>
                <div style={{ flex:1, display:'flex', gap:2, flexWrap:'wrap', padding:'0 8px' }}>
                  {Array.from({ length: Math.min(punches[type], 20) }).map((_, i) => (
                    <div key={i} style={{ width:5, height:12, background: i % 5 === 4 ? 'var(--gold)' : 'var(--red)', borderRadius:1, opacity:0.8 }} />
                  ))}
                </div>
                <span style={{ fontFamily:'"Bebas Neue"', fontSize:'1.4rem', color:'#fff', width:36, textAlign:'right' }}>{punches[type]}</span>
              </div>
            ))}
          </div>

          {/* Combos */}
          {Object.keys(combos).length > 0 && (
            <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
              <div className="section-label">Combos</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {Object.entries(combos).sort((a,b) => b[1]-a[1]).map(([name, count]) => (
                  <span key={name} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.25)', padding:'3px 8px', fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', color:'var(--gold)' }}>
                    <span style={{ background:'var(--gold)', color:'#000', fontSize:'0.55rem', padding:'1px 4px', fontWeight:700 }}>{count}</span>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Coach messages */}
          <div style={{ display:'flex', flexDirection:'column', minHeight:220, maxHeight:360, paddingTop:0 }}>
            <div style={{ padding:'14px 20px 0', flexShrink:0 }}>
              <div className="section-label">Coach Feedback</div>
            </div>
            <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'8px 20px 16px', display:'flex', flexDirection:'column', gap:8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  background:'#0d0d0d', border:'1px solid var(--border)',
                  borderLeft: `2px solid ${m.type==='system' ? 'var(--red)' : m.tag==='AI COACH' ? 'var(--red)' : 'var(--gold)'}`,
                  padding:'9px 12px', fontSize:'0.82rem', lineHeight:1.5, color:'var(--text)',
                }}>
                  <span style={{ display:'block', fontFamily:'"Share Tech Mono"', fontSize:'0.58rem', letterSpacing:2, color: m.tag==='AI COACH' ? 'var(--red)' : 'var(--gold)', marginBottom:4 }}>{m.tag}</span>
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes comboIn { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.7)} 15%{opacity:1;transform:translate(-50%,-50%) scale(1.08)} 70%{opacity:1} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.05)} }`}</style>
    </div>
  );
}
