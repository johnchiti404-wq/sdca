class SoundManager {
  private sounds: Record<string, HTMLAudioElement> = {};
  private unlocked = false;

  constructor() {
    this.sounds.message = new Audio('/sounds/message.mp3');
    this.sounds.arrived = new Audio('/sounds/arrived.mp3');
    this.sounds.accepted = new Audio('/sounds/accepted.mp3');
    this.sounds.ready = new Audio('/sounds/ready.mp3');
    this.sounds.readyy = new Audio('/sounds/readyy.mp3');
    this.sounds.closed = new Audio('/sounds/closed.mp3');
    this.sounds.stock = new Audio('/sounds/stock.mp3');
    this.sounds.store = new Audio('/sounds/store.mp3');
    this.sounds.picked = new Audio('/sounds/picked.mp3');
    this.sounds.delivered = new Audio('/sounds/delivered.mp3');

    Object.values(this.sounds).forEach((audio) => {
      audio.preload = 'auto';
      audio.volume = 0.6;
    });

    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;

      Object.values(this.sounds).forEach((audio) => {
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {});
      });

      window.removeEventListener('pointerdown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
  }

  play(name: 'message' | 'arrived' | 'accepted' | 'ready' | 'readyy' | 'closed' | 'stock' | 'store' | 'picked' | 'delivered') {
    const audio = this.sounds[name];
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.error(`Error playing ${name} sound:`, error);
    });
  }
}

export const soundManager = new SoundManager();
