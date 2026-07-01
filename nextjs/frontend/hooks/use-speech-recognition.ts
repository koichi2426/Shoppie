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
  const [micError, setMicError] = useState<string | null>(null);
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
    setMicError(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already started|recognition has already started/i.test(message)) {
        setIsListening(true);
        setMicError(null);
        return;
      }
      clientLogger.warn('voice recognition start threw', { error: message });
      // onstart / onerror が来るまで断定しない（WebKitでは throw 後も動くことがある）
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

    recognition.onstart = () => {
      setIsListening(true);
      setMicError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (loadingRef.current) return;

      setMicError(null);

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
      const code = event.error;
      if (code === 'aborted' || code === 'no-speech') {
        return;
      }

      clientLogger.warn('voice recognition error', { error: code });
      setIsListening(false);

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setMicError('マイクの利用がブロックされています。SafariやChromeで開いてください');
      } else if (code === 'audio-capture') {
        setMicError('マイクにアクセスできませんでした');
      }
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
      setMicError(null);
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
    micError,
    toggleRecognition,
    stopRecognition,
    clearTranscript,
  };
}
