
// services/audioService.ts

class AudioService {
    private audioContext: AudioContext | null = null;
    private sfxGainNode: GainNode | null = null;
    private musicGainNode: GainNode | null = null;
    private isMusicMuted: boolean = false;
    private backgroundSound: AudioBufferSourceNode | null = null;
    
    private sfxVolume: number = 0.3;
    private musicVolume: number = 0.05;

    // Buffers for custom sounds
    private customCorrectSound: AudioBuffer | null = null;
    private customIncorrectSound: AudioBuffer | null = null;
    private customBackgroundMusic: AudioBuffer | null = null;


    private initAudioContext() {
        if (!this.audioContext && typeof window !== 'undefined') {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                
                // SFX Channel (always on)
                this.sfxGainNode = this.audioContext.createGain();
                this.sfxGainNode.gain.value = this.sfxVolume;
                this.sfxGainNode.connect(this.audioContext.destination);

                // Music Channel (mutable)
                this.musicGainNode = this.audioContext.createGain();
                this.musicGainNode.gain.value = this.isMusicMuted ? 0 : this.musicVolume;
                this.musicGainNode.connect(this.audioContext.destination);

            } catch (e) {
                console.error("Web Audio API is not supported in this browser");
            }
        }
    }

    private loadSoundFromFile(file: File): Promise<AudioBuffer | null> {
        this.initAudioContext();
        if (!this.audioContext) return Promise.resolve(null);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (event.target && event.target.result instanceof ArrayBuffer) {
                    try {
                        const audioBuffer = await this.audioContext!.decodeAudioData(event.target.result);
                        resolve(audioBuffer);
                    } catch (e) {
                        console.error('Error decoding audio data', e);
                        // Resolve with null to not break the chain for other files
                        resolve(null);
                    }
                } else {
                     resolve(null);
                }
            };
            reader.onerror = (error) => {
                console.error(`Failed to read file ${file.name}`, error);
                resolve(null);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    
    public async loadCustomSounds(audioFiles: { correct: File | null; incorrect: File | null; background: File | null }) {
        this.clearCustomSounds(); 
        
        if (audioFiles.correct) {
            this.customCorrectSound = await this.loadSoundFromFile(audioFiles.correct);
        }
        if (audioFiles.incorrect) {
            this.customIncorrectSound = await this.loadSoundFromFile(audioFiles.incorrect);
        }
        if (audioFiles.background) {
            this.customBackgroundMusic = await this.loadSoundFromFile(audioFiles.background);
        }
    }
    
    public clearCustomSounds() {
        this.stopMusic();
        this.customCorrectSound = null;
        this.customIncorrectSound = null;
        this.customBackgroundMusic = null;
    }
    
    private playBuffer(buffer: AudioBuffer, destinationNode: AudioNode | null, isLooping: boolean = false) {
        if (!this.audioContext || !destinationNode) return;
        
        if (isLooping && this.backgroundSound) {
            this.backgroundSound.stop();
            this.backgroundSound.disconnect();
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = isLooping;
        source.connect(destinationNode);
        source.start(0);

        if (isLooping) {
            this.backgroundSound = source;
        }
    }


    public playSound(type: 'click' | 'correct' | 'incorrect' | 'win' | 'move' | 'buzz') {
        this.initAudioContext();
        if (!this.audioContext || !this.sfxGainNode) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // --- Custom Sound Handling ---
        if (type === 'correct' && this.customCorrectSound) {
            this.playBuffer(this.customCorrectSound, this.sfxGainNode);
            return;
        }
        if (type === 'incorrect' && this.customIncorrectSound) {
            this.playBuffer(this.customIncorrectSound, this.sfxGainNode);
            return;
        }
        // --- End Custom Sound Handling ---

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.sfxGainNode); // Connect to SFX channel

        const now = this.audioContext.currentTime;

        switch (type) {
            case 'click':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;

            case 'correct':
                oscillator.frequency.setValueAtTime(523, now);
                oscillator.frequency.setValueAtTime(659, now + 0.1);
                oscillator.frequency.setValueAtTime(784, now + 0.2);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.setValueAtTime(0.2, now + 0.2);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                oscillator.start(now);
                oscillator.stop(now + 0.4);
                break;

            case 'incorrect':
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                gainNode.gain.setValueAtTime(0.2, now);
                oscillator.type = 'sawtooth';
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
            
            case 'win': { // Use a block to scope variables
                // 1. Arpeggio part
                const arpeggioOscillator = this.audioContext.createOscillator();
                const arpeggioGain = this.audioContext.createGain();
                arpeggioOscillator.connect(arpeggioGain);
                arpeggioGain.connect(this.sfxGainNode);

                const arpeggioNow = this.audioContext.currentTime;
                arpeggioOscillator.type = 'triangle';
                arpeggioGain.gain.setValueAtTime(0.25, arpeggioNow);
                arpeggioGain.gain.exponentialRampToValueAtTime(0.01, arpeggioNow + 0.8);
                
                // C5, E5, G5, C6 arpeggio
                arpeggioOscillator.frequency.setValueAtTime(523.25, arpeggioNow);
                arpeggioOscillator.frequency.setValueAtTime(659.25, arpeggioNow + 0.1);
                arpeggioOscillator.frequency.setValueAtTime(783.99, arpeggioNow + 0.2);
                arpeggioOscillator.frequency.setValueAtTime(1046.50, arpeggioNow + 0.3);

                arpeggioOscillator.start(arpeggioNow);
                arpeggioOscillator.stop(arpeggioNow + 0.8);
                
                // 2. "Yeah!" cheer effect with white noise
                const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.5, this.audioContext.sampleRate);
                const noiseData = noiseBuffer.getChannelData(0);
                for (let i = 0; i < noiseData.length; i++) {
                    noiseData[i] = Math.random() * 2 - 1;
                }

                const noiseSource = this.audioContext.createBufferSource();
                noiseSource.buffer = noiseBuffer;
                
                const noiseGain = this.audioContext.createGain();
                noiseSource.connect(noiseGain);
                noiseGain.connect(this.sfxGainNode);

                const noiseNow = this.audioContext.currentTime + 0.1; // Start slightly after arpeggio
                noiseGain.gain.setValueAtTime(0, noiseNow);
                noiseGain.gain.linearRampToValueAtTime(0.2, noiseNow + 0.1); // Quick rise
                noiseGain.gain.exponentialRampToValueAtTime(0.01, noiseNow + 0.4); // Decay

                noiseSource.start(noiseNow);
                noiseSource.stop(noiseNow + 0.5);
                
                break;
            }

            case 'move':
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.2);
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                oscillator.type = 'square';
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                break;
            
            case 'buzz':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(1000, now);
                gainNode.gain.setValueAtTime(0.3, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
        }
    }

    public startMusic() {
        this.initAudioContext();
        if (!this.audioContext || !this.musicGainNode || this.backgroundSound) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (this.customBackgroundMusic) {
            this.playBuffer(this.customBackgroundMusic, this.musicGainNode, true);
            return;
        }
        
        // --- Fallback synthesized professional music ---
        const tempo = 125;
        const quarterNoteTime = 60 / tempo;
        const barDuration = quarterNoteTime * 4;
        const loopDuration = barDuration * 2; // 2-bar loop

        const bufferSize = Math.ceil(this.audioContext.sampleRate * loopDuration);
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        // --- Sound Generation Functions ---
        const createKick = (t: number) => 0.8 * Math.sin(2 * Math.PI * 120 * Math.exp(-t * 20)) * Math.exp(-t * 15);
        const createHihat = (t: number) => (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.2;

        const bassNotes = [130.81, 130.81, 155.56, 130.81, 196.00, 196.00, 155.56, 196.00]; // C3, C3, Eb3, C3, G3, G3, Eb3, G3
        const arpNotes = [392.00, 466.16, 523.25, 466.16, 392.00, 311.13, 261.63, 311.13]; // G4, Bb4, C5, ...

        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;
            let sample = 0;
            const timeInLoop = t % loopDuration;

            // Kick on 1 and 3 of each bar
            const timeInBar = timeInLoop % barDuration;
            if (timeInBar < 0.2) sample += createKick(timeInBar);
            if (timeInBar > quarterNoteTime * 2 && timeInBar < quarterNoteTime * 2 + 0.2) {
                sample += createKick(timeInBar - quarterNoteTime * 2);
            }

            // Hi-hat on every 8th note
            const eighthNoteTime = quarterNoteTime / 2;
            if ((timeInLoop % eighthNoteTime) < 0.1) {
                sample += createHihat(timeInLoop % eighthNoteTime);
            }

            // Bassline on every quarter note
            const bassIndex = Math.floor(timeInLoop / quarterNoteTime) % bassNotes.length;
            const bassFreq = bassNotes[bassIndex];
            const timeInBassNote = timeInLoop % quarterNoteTime;
            sample += Math.sin(2 * Math.PI * bassFreq * timeInBassNote) * Math.exp(-timeInBassNote * 5) * 0.4;
            
            // Arpeggio on every 16th note
            const sixteenthNoteTime = quarterNoteTime / 4;
            const arpIndex = Math.floor(timeInLoop / sixteenthNoteTime) % arpNotes.length;
            const arpFreq = arpNotes[arpIndex];
            const timeInArpNote = timeInLoop % sixteenthNoteTime;
            sample += Math.sin(2 * Math.PI * arpFreq * timeInArpNote) * Math.exp(-timeInArpNote * 20) * 0.25;

            data[i] = sample * 0.7; // Reduce overall volume to prevent clipping
        }
        
        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(800, this.audioContext.currentTime);
        lowpass.Q.setValueAtTime(1, this.audioContext.currentTime);
        lowpass.connect(this.musicGainNode);

        this.playBuffer(buffer, lowpass, true);
    }

    public stopMusic() {
        if (this.backgroundSound) {
            try {
                this.backgroundSound.stop();
                this.backgroundSound.disconnect();
            } catch (e) {
                // Ignore errors if the node is already stopped
            }
            this.backgroundSound = null;
        }
    }

    public setMusicMute(muted: boolean) {
        this.isMusicMuted = muted;
        this.initAudioContext();
        if (this.musicGainNode && this.audioContext) {
            this.musicGainNode.gain.setValueAtTime(this.isMusicMuted ? 0 : this.musicVolume, this.audioContext.currentTime);
        }
    }
}

export const audioService = new AudioService();