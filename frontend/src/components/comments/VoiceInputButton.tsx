import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function VoiceInputButton({ onTranscript, disabled = false }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    }
  }, []);

  const supported = typeof window !== 'undefined' && Boolean(recognitionConstructor());

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) return;
    setError('');
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) transcriptRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not capture speech. Please try again.');
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError('Could not start the microphone. Please try again.');
      setListening(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-center gap-1 self-end">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || !supported}
        aria-label={listening ? 'Stop voice input' : 'Dictate comment'}
        aria-pressed={listening}
        title={supported ? (listening ? 'Stop voice input' : 'Dictate comment') : 'Voice input is not supported in this browser'}
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${listening ? 'bg-rose-100 text-rose-600' : 'bg-violet-100 text-violet-600 hover:bg-violet-200'}`}
      >
        {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
      {error && <span role="alert" className="max-w-40 text-center text-[10px] text-rose-600">{error}</span>}
    </span>
  );
}
