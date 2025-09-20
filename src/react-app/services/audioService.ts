export class AudioService {
  private static instance: AudioService;
  private audioContext: AudioContext | null = null;
  private isMuted = false;

  private constructor() {
    // Don't initialize audio context until first user interaction
    // Some browsers require user gesture before audio can play
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private async initializeAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Resume audio context if it's suspended (required by some browsers)
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      } catch (error) {
        console.warn('Audio not supported:', error);
      }
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public async playCelebrationSound() {
    if (this.isMuted) {
      return;
    }

    if (!this.audioContext) {
      await this.initializeAudioContext();
    }

    try {
      // Ensure audio context is initialized and resumed
      await this.initializeAudioContext();
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.audioContext) {
        return;
      }

      // Create a celebratory fanfare-style sound
      this.playFanfareSound();
    } catch (error) {
      console.warn('Could not play celebration sound:', error);
    }
  }

  private playFanfareSound() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const masterGain = this.audioContext.createGain();
    masterGain.connect(this.audioContext.destination);
    masterGain.gain.setValueAtTime(0.3, now); // Overall volume

    // Create a triumphant fanfare with multiple notes
    const notes = [
      { freq: 523.25, start: 0, duration: 0.15 },     // C5
      { freq: 659.25, start: 0.1, duration: 0.15 },   // E5
      { freq: 783.99, start: 0.2, duration: 0.15 },   // G5
      { freq: 1046.5, start: 0.3, duration: 0.25 },   // C6 (higher)
      { freq: 1046.5, start: 0.5, duration: 0.15 },   // C6 again
      { freq: 1174.66, start: 0.6, duration: 0.2 },   // D6
      { freq: 1318.51, start: 0.75, duration: 0.3 }   // E6 (finale)
    ];

    notes.forEach((note) => {
      this.playNote(masterGain, note.freq, now + note.start, note.duration);
    });

    // Add some sparkle with higher frequency chimes
    setTimeout(() => {
      this.playSparkleEffect();
    }, 200);
  }

  private playNote(destination: AudioNode, frequency: number, startTime: number, duration: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    // Use a warmer triangle wave for a more pleasant sound
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    
    // Create a nice attack-decay envelope
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.8, startTime + 0.02); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.3, startTime + duration * 0.3); // Sustain
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration); // Decay
    
    oscillator.connect(gainNode);
    gainNode.connect(destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  private playSparkleEffect() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const sparkleGain = this.audioContext.createGain();
    sparkleGain.connect(this.audioContext.destination);
    sparkleGain.gain.setValueAtTime(0.15, now); // Quieter sparkle

    // High frequency sparkle notes
    const sparkleNotes = [
      { freq: 1568, start: 0, duration: 0.1 },
      { freq: 1760, start: 0.05, duration: 0.1 },
      { freq: 1975.5, start: 0.1, duration: 0.1 },
      { freq: 2093, start: 0.15, duration: 0.12 },
      { freq: 2217.46, start: 0.25, duration: 0.1 }
    ];

    sparkleNotes.forEach((note) => {
      this.playSparkleNote(sparkleGain, note.freq, now + note.start, note.duration);
    });
  }

  private playSparkleNote(destination: AudioNode, frequency: number, startTime: number, duration: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    // Use sine wave for pure, crystalline sparkle sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    
    // Quick sparkle envelope
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.6, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  // Play a simple success chime (alternative to fanfare)
  public async playSuccessChime() {
    if (this.isMuted || !this.audioContext) {
      return;
    }

    try {
      await this.initializeAudioContext();
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      const masterGain = this.audioContext.createGain();
      masterGain.connect(this.audioContext.destination);
      masterGain.gain.setValueAtTime(0.4, now);

      // Simple ascending chime
      const chimeNotes = [
        { freq: 523.25, start: 0, duration: 0.3 },    // C5
        { freq: 659.25, start: 0.15, duration: 0.3 }, // E5
        { freq: 783.99, start: 0.3, duration: 0.4 },  // G5
      ];

      chimeNotes.forEach((note) => {
        this.playNote(masterGain, note.freq, now + note.start, note.duration);
      });
    } catch (error) {
      console.warn('Could not play success chime:', error);
    }
  }

  // Clean up resources
  public dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export a singleton instance
export const audioService = AudioService.getInstance();