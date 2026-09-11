import { useRef, useState, useCallback, useEffect } from 'react';

// Two channels:
//   urgent - jumps the queue and is never dropped (safety cues like "hands up")
//   normal - queued in order, dropped once the queue is full
// Nothing cuts off speech mid-sentence; callers pace their own chatter so the
// queue never becomes the backlog it used to be.
const LEVELS = { normal: 0, urgent: 1 };
const QUEUE_LIMIT = 3;

// Delivery. The spec allows rate 0.1-10, but intelligibility falls off fast
// past ~1.5 and some voices clamp or ignore extremes. 1.3 is a corner-man's
// clip: quick, still clear. Pitch <1 reads as a deeper voice.
const SPEECH_RATE  = 1.3;
const SPEECH_PITCH = 0.9;

export function useSpeech() {
  const queueRef      = useRef([]);
  const speakingRef   = useRef(false);
  const enabledRef    = useRef(true);
  const currentUttRef  = useRef(null);
  const currentRankRef = useRef(null);

  // Voice availability is a ref (so `speak` stays referentially stable and
  // doesn't churn the caller's effects) plus a tick of state purely to
  // re-render when voices finally arrive.
  const voicesReadyRef = useRef(false);
  const [, setVoicesTick] = useState(0);

  const canUseSpeech = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false;
    return true;
  }, []);

  const getPreferredVoice = useCallback(() => {
    if (!canUseSpeech()) return null;

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    return voices.find(v =>
      v.lang?.toLowerCase().startsWith('en') && /US|GB|AU|CA|IN/i.test(v.lang)
    ) || voices.find(v => v.lang?.toLowerCase().startsWith('en')) || voices[0] || null;
  }, [canUseSpeech]);

  const resumeSpeech = useCallback(() => {
    if (!canUseSpeech()) return false;
    try {
      const synth = window.speechSynthesis;
      if (synth?.paused) synth.resume();
      return true;
    } catch {
      return false;
    }
  }, [canUseSpeech]);

  const hasVoices = useCallback(() => voicesReadyRef.current, []);

  // Chrome populates getVoices() asynchronously and fires `voiceschanged` when
  // it's done; Safari is synchronous. Without this the first speak() is dropped
  // and the "no voices installed" banner never clears.
  useEffect(() => {
    if (!canUseSpeech()) return;
    const synth = window.speechSynthesis;

    const sync = () => {
      const ready = (synth.getVoices() || []).length > 0;
      if (ready !== voicesReadyRef.current) {
        voicesReadyRef.current = ready;
        setVoicesTick(t => t + 1);
      }
    };

    sync();
    synth.addEventListener?.('voiceschanged', sync);
    return () => synth.removeEventListener?.('voiceschanged', sync);
  }, [canUseSpeech]);

  // Browsers suspend speech until the page has been interacted with.
  useEffect(() => {
    const activate = () => resumeSpeech();
    document.addEventListener('pointerdown', activate, { passive: true });
    document.addEventListener('keydown', activate, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', activate);
      document.removeEventListener('keydown', activate);
    };
  }, [resumeSpeech]);

  const processQueue = useCallback(() => {
    if (!canUseSpeech()) return;
    if (speakingRef.current || queueRef.current.length === 0) return;

    const item  = queueRef.current.shift();
    const utt   = new SpeechSynthesisUtterance(item.text);
    const voice = getPreferredVoice();

    utt.rate   = SPEECH_RATE;
    utt.pitch  = SPEECH_PITCH;
    utt.volume = 1;
    utt.lang   = voice?.lang || 'en-US';
    utt.voice  = voice;

    // A cancelled utterance still fires onerror after its replacement has
    // started. Ignore anything that is no longer the current utterance,
    // otherwise it clears `speakingRef` while the new one is mid-sentence.
    const settle = (fn) => () => {
      if (currentUttRef.current !== utt) return;
      currentUttRef.current  = null;
      currentRankRef.current = null;
      speakingRef.current = false;
      fn?.();
      processQueue();
    };

    utt.onend   = settle();
    utt.onerror = settle(function () {
      // `canceled` / `interrupted` are what cancel() produces — expected here.
    });

    currentUttRef.current  = utt;
    currentRankRef.current = item.rank;
    speakingRef.current = true;
    window.speechSynthesis.speak(utt);
  }, [canUseSpeech, getPreferredVoice]);

  const speak = useCallback((text, level = 'normal') => {
    if (!enabledRef.current || !text) return;
    if (!resumeSpeech() || !canUseSpeech()) return;
    if (!voicesReadyRef.current) return;

    const rank = LEVELS[level] ?? LEVELS.normal;
    const item = { text: String(text), rank };

    if (rank === LEVELS.urgent) {
      // Plays next rather than cutting in: speak() appends to the browser's own
      // queue, so only cancel() interrupts — and interrupting would mean
      // talking over the AI coach mid-sentence.
      queueRef.current.unshift(item);
      processQueue();
      return;
    }

    if (queueRef.current.length >= QUEUE_LIMIT) return;
    queueRef.current.push(item);
    processQueue();
  }, [canUseSpeech, processQueue, resumeSpeech]);

  const setEnabled = useCallback((val) => {
    enabledRef.current = val;
    if (!val && canUseSpeech()) {
      window.speechSynthesis.cancel();
      queueRef.current      = [];
      speakingRef.current   = false;
      currentUttRef.current = null;
    }
  }, [canUseSpeech]);

  return { speak, setEnabled, resumeSpeech, hasVoices };
}
