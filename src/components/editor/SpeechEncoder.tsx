import { createSignal } from 'solid-js';
import { useUmweltSpec } from '../../contexts/UmweltSpecContext';
import { EncodingPropName } from '../../types';

// Maps spoken words to visual axis/property names
const VISUAL_AXIS_MAP: Record<string, EncodingPropName> = {
  'x': 'x',
  'x axis': 'x',
  'horizontal': 'x',
  'y': 'y',
  'y axis': 'y',
  'vertical': 'y',
  'color': 'color',
  'colour': 'color',
  'size': 'size',
  'opacity': 'opacity',
};

// Maps spoken words to audio property names
const AUDIO_PROP_MAP: Record<string, EncodingPropName> = {
  'pitch': 'pitch',
  'note': 'pitch',
  'tone': 'pitch',
  'frequency': 'pitch',
  'volume': 'volume',
  'loudness': 'volume',
  'duration': 'duration',
  'length': 'duration',
  'time': 'duration',
};

export function SpeechEncoder() {
  const [spec, specActions] = useUmweltSpec();

  // listening = true when the mic is active
  const [listening, setListening] = createSignal(false);

  // statusMessage shows feedback below the button after you speak
  const [statusMessage, setStatusMessage] = createSignal('');

  // Gets the name of the first visual unit (e.g. "vis_unit_0")
  const getFirstVisualUnit = () => spec.visual.units[0]?.name;

  // Gets the name of the first audio unit (e.g. "audio_unit_0")
  const getFirstAudioUnit = () => spec.audio.units[0]?.name;

  // This function takes what you said and figures out what command it is
  const parseCommand = (transcript: string) => {
    const lower = transcript.toLowerCase().trim();

    // --- Command: "add visual unit" ---
    if (
      lower.includes('add visual unit') ||
      lower.includes('add a visual unit') ||
      lower.includes('new visual unit') ||
      lower.includes('create visual unit') ||
      lower.includes('create a visual unit')
    ) {
      return { type: 'addVisualUnit' };
    }

    // --- Command: "remove visual unit" or "remove unit <name>" ---
    if (lower.includes('remove visual unit') || lower.includes('delete visual unit')) {
      return { type: 'removeVisualUnit', unitName: undefined };
    }
    const removeVisualMatch = lower.match(/(?:remove|delete)\s+visual\s+unit\s+(.+)/);
    if (removeVisualMatch) {
      return { type: 'removeVisualUnit', unitName: removeVisualMatch[1].trim() };
    }

    // --- Command: "add audio unit" ---
    if (
      lower.includes('add audio unit') ||
      lower.includes('add an audio unit') ||
      lower.includes('add a audio unit') ||
      lower.includes('new audio unit') ||
      lower.includes('create audio unit') ||
      lower.includes('create an audio unit')
    ) {
      return { type: 'addAudioUnit' };
    }

    // --- Command: "remove audio unit" or "remove audio unit <name>" ---
    if (lower.includes('remove audio unit') || lower.includes('delete audio unit')) {
      return { type: 'removeAudioUnit', unitName: undefined };
    }
    const removeAudioMatch = lower.match(/(?:remove|delete)\s+audio\s+unit\s+(.+)/);
    if (removeAudioMatch) {
      return { type: 'removeAudioUnit', unitName: removeAudioMatch[1].trim() };
    }

    // --- Command: "change mark to bar" ---
    const markMatch = lower.match(/(?:change|set)\s+mark\s+to\s+(.+)/);
    if (markMatch) {
      return { type: 'changeMark', mark: markMatch[1].trim() };
    }

    // --- Command: "encode price as pitch" (audio encoding) ---
    // We check audio first because some audio props like "rate" could be confused
    const encodePatterns = [
      /(?:encode|map|set|assign)\s+(.+?)\s+(?:as|to|on|for)\s+(.+)/,
      /(.+?)\s+(?:as|to|on)\s+(?:the\s+)?(.+?)\s+(?:axis|field|channel|property)?$/,
    ];

    for (const pattern of encodePatterns) {
      const match = lower.match(pattern);
      if (match) {
        const spokenField = match[1].trim(); // e.g. "price"
        const spokenProp = match[2].trim();  // e.g. "pitch" or "x"

        // Find a matching field in the dataset (exact match first)
        const matchedField = spec.fields.find(
          (f) => f.active && f.name.toLowerCase() === spokenField
        );

        // Fuzzy match if no exact match (e.g. "pric" finds "price")
        const fuzzyField = matchedField || spec.fields.find(
          (f) => f.active && f.name.toLowerCase().includes(spokenField)
        );

        // Check if it's an audio property
        const audioProperty = AUDIO_PROP_MAP[spokenProp];
        if (fuzzyField && audioProperty) {
          return { type: 'encodeAudio', field: fuzzyField.name, property: audioProperty };
        }

        // Check if it's a visual property
        const visualProperty = VISUAL_AXIS_MAP[spokenProp];
        if (fuzzyField && visualProperty) {
          return { type: 'encodeVisual', field: fuzzyField.name, property: visualProperty };
        }
      }
    }

    // Nothing matched
    return null;
  };

  // This runs when you click the mic button
  const startListening = () => {
    // Check if the browser supports speech recognition (works best in Chrome)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported. Try Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false; // only give us the final result
    recognition.maxAlternatives = 3;    // try up to 3 interpretations of what you said

    setListening(true);
    setStatusMessage('Listening...');
    recognition.start();

    // This runs when the browser has finished hearing you
    recognition.onresult = (event: any) => {
      for (let i = 0; i < event.results[0].length; i++) {
        const transcript = event.results[0][i].transcript;
        console.log('Heard:', transcript);

        const command = parseCommand(transcript);

        if (command) {

          // --- Add a visual unit ---
          if (command.type === 'addVisualUnit') {
            specActions.addVisualUnit();
            setStatusMessage('Added a new visual unit');
            return;
          }

          // --- Remove a visual unit ---
          if (command.type === 'removeVisualUnit') {
            const units = spec.visual.units;
            if (units.length <= 1) {
              setStatusMessage('Cannot remove the only visual unit');
              return;
            }
            // Remove named unit, or the last one if no name given
            const target = command.unitName
              ? units.find((u) => u.name.toLowerCase().includes(command.unitName!))
              : units[units.length - 1];
            if (target) {
              specActions.removeVisualUnit(target.name);
              setStatusMessage(`Removed visual unit "${target.name}"`);
            } else {
              setStatusMessage(`No visual unit named "${command.unitName}" found`);
            }
            return;
          }

          // --- Add an audio unit ---
          if (command.type === 'addAudioUnit') {
            specActions.addAudioUnit();
            setStatusMessage('Added a new audio unit');
            return;
          }

          // --- Remove an audio unit ---
          if (command.type === 'removeAudioUnit') {
            const units = spec.audio.units;
            if (units.length <= 1) {
              setStatusMessage('Cannot remove the only audio unit');
              return;
            }
            // Remove named unit, or the last one if no name given
            const target = command.unitName
              ? units.find((u) => u.name.toLowerCase().includes(command.unitName!))
              : units[units.length - 1];
            if (target) {
              specActions.removeAudioUnit(target.name);
              setStatusMessage(`Removed audio unit "${target.name}"`);
            } else {
              setStatusMessage(`No audio unit named "${command.unitName}" found`);
            }
            return;
          }

          // --- Change mark type (e.g. bar, line, point) ---
          if (command.type === 'changeMark') {
            const unit = getFirstVisualUnit();
            if (!unit) {
              setStatusMessage('No visual unit found');
              return;
            }
            specActions.changeMark(unit, command.mark as any);
            setStatusMessage(`Changed mark to "${command.mark}"`);
            return;
          }

          // --- Encode a field to a visual axis ---
          if (command.type === 'encodeVisual' && command.field && command.property) {
            const unit = getFirstVisualUnit();
            if (!unit) {
              setStatusMessage('No visual unit found. Say "add visual unit" first.');
              return;
            }
            specActions.addEncoding(command.field, command.property as EncodingPropName, unit);
            setStatusMessage(`Encoded "${command.field}" as visual ${command.property}`);
            return;
          }

          // --- Encode a field to an audio property ---
          if (command.type === 'encodeAudio' && command.field && command.property) {
            const unit = getFirstAudioUnit();
            if (!unit) {
              setStatusMessage('No audio unit found. Say "add audio unit" first.');
              return;
            }
            specActions.addEncoding(command.field, command.property as EncodingPropName, unit);
            setStatusMessage(`Encoded "${command.field}" as audio ${command.property}`);
            return;
          }
        }
      }

      // If we get here, nothing matched
      setStatusMessage(`Couldn't understand: "${event.results[0][0].transcript}". Try: "encode price as pitch"`);
    };

    // This runs if something goes wrong with the mic
    recognition.onerror = (event: any) => {
      setStatusMessage(`Error: ${event.error}`);
      setListening(false);
    };

    // This runs when the mic stops (whether successful or not)
    recognition.onend = () => {
      setListening(false);
    };
  };

  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', margin: '4px 0' }}>
      <button
        onClick={startListening}
        disabled={listening()}
        style={{
          border: '1px solid #ccc',
          background: 'white',
          'border-radius': '4px',
          padding: '2px 10px',
          'font-size': '14px',
          cursor: listening() ? 'not-allowed' : 'pointer',
          color: 'black',
        }}
      >
        {listening() ? ' Listening...' : 'Mic'}
      </button>

      {/* Show status message after speaking */}
      {statusMessage() && (
        <span style={{ 'font-size': '13px', color: '#555' }}>
          {statusMessage()}
        </span>
      )}
    </div>
  );
}