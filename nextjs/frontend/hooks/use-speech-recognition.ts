import { useEffect, useRef, useState } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type {
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent,
  SpeechRecognitionInstance,
  WindowWithSpeechRecognition,
} from '@/types/speech-recognition';

interface UseSpeechRecognitionOptions {
  onFinalTranscript: (text: string) => void;
  loadingRef: React.RefObject<boolean>;
  disabled?: boolean;
}

export function useSpeechRecognition({
  onFinalTranscript,
  loadingRef,
  disabled = false,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastVoiceInputRef = useRef('');
  const onFinalTranscriptRef = useRef(onFinalTranscript);

  onFinalTranscriptRef.current = onFinalTranscript;

  const stopRecognition = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // already stopped
    }
    setIsListening(false);
  };

  const startRecognition = () => {
    if (!recognitionRef.current || loadingRef.current || disabled) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // already running
    }
  };

  useEffect(() => {
    if (disabled) {
      stopRecognition();
      setTranscript('');
    }
  }, [disabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const win = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    setIsSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (loadingRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript.trim() && finalTranscript !== lastVoiceInputRef.current) {
        lastVoiceInputRef.current = finalTranscript;
        onFinalTranscriptRef.current(finalTranscript);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          setTranscript('');
        }, 2000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clientLogger.error('voice recognition error', { error: event.error });
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      recognition.stop();
    };
  }, [loadingRef]);

  const toggleRecognition = () => {
    if (disabled) return;
    if (isListening) {
      stopRecognition();
      setTranscript('');
    } else {
      setTranscript('');
      startRecognition();
    }
  };

  const clearTranscript = () => setTranscript('');

  return {
    isListening,
    transcript,
    isSupported,
    toggleRecognition,
    stopRecognition,
    clearTranscript,
  };
}
