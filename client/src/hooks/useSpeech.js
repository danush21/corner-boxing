import { useRef, useCallback, useEffect } from 'react';

export function useSpeech() {
  const queueRef     = useRef([]);
  const speakingRef  = useRef(false);
  const enabledRef   = useRef(true);

  const getPreferredVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const preferred = voices.find(v =>
      v.lang?.toLowerCase().startsWith('en') && /US|GB|AU|CA|IN/i.test(v.lang)
    ) || voices.find(v => v.lang?.toLowerCase().startsWith('en')) || voices[0] || null;

    return preferred;
  }, []);

  const resumeSpeech = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false;

    try {
      const synth = window.speechSynthesis;
      if (synth?.paused) synth.resume();
      return true;
    } catch {
      return false;
    }
  }, []);

  const canUseSpeech = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return false;
    return true;
  }, []);

  const hasVoices = useCallback(() => {
    if (!canUseSpeech()) return false;
    const voices = window.speechSynthesis.getVoices();
    return Array.isArray(voices) && voices.length > 0;
  }, [canUseSpeech]);

  useEffect(() => {
    const activate = () => {
      resumeSpeech();
    };

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

    const text = queueRef.current.shift();
    const utt  = new SpeechSynthesisUtterance(text);
    const voice = getPreferredVoice();

    utt.rate  = 1.05;
    utt.pitch = 0.9;
    utt.volume = 1;
    utt.lang = voice?.lang || 'en-US';
    utt.voice = voice;

    utt.onstart = () => {
      console.log('TTS started:', { text, voice: utt.voice?.name || 'default', lang: utt.lang, speaking: window.speechSynthesis.speaking, pending: window.speechSynthesis.pending });
    };
    utt.onerror = (e) => {
      if (e?.error === 'canceled') {
        console.log('TTS canceled intentionally:', { text, voice: utt.voice?.name || 'default', lang: utt.lang, speaking: window.speechSynthesis.speaking, pending: window.speechSynthesis.pending });
        return;
      }
      console.error('TTS error:', e?.error, e);
    };
    utt.onend = () => {
      console.log('TTS ended:', { text, voice: utt.voice?.name || 'default', lang: utt.lang });
      speakingRef.current = false;
      processQueue();
    };

    speakingRef.current = true;
    console.log('TTS speak call:', { text, voice: utt.voice?.name || 'default', lang: utt.lang, voices: window.speechSynthesis.getVoices().length });
    window.speechSynthesis.speak(utt);
  }, [canUseSpeech, getPreferredVoice]);

  const speak = useCallback((text, priority = false) => {
    if (!enabledRef.current || !text) return;
    if (!resumeSpeech() || !canUseSpeech()) return;

    if (!hasVoices()) {
      console.warn('Speech synthesis is available but no system voices are installed for this browser.');
      return;
    }

    if (priority) {
      queueRef.current = [String(text), ...queueRef.current].slice(0, 3);
      speakingRef.current = false;
      processQueue();
      return;
    }

    if (queueRef.current.length > 2) return;
    queueRef.current.push(String(text));
    processQueue();
  }, [canUseSpeech, hasVoices, processQueue, resumeSpeech]);

  const setEnabled = useCallback((val) => {
    enabledRef.current = val;
    if (!val && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      queueRef.current    = [];
      speakingRef.current = false;
    }
  }, []);

  return { speak, setEnabled, resumeSpeech, hasVoices };
}
