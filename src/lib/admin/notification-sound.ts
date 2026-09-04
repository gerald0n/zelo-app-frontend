'use client';

/**
 * Bipe curto (dois tons) pra sinalizar pedido novo no quadro — gerado via
 * Web Audio API, sem arquivo de áudio pra manter/servir. Silencioso em erro
 * (autoplay bloqueado pelo navegador, API indisponível etc.): o indicador
 * visual "ao vivo" já cobre o caso de o som não tocar.
 */
export function playNewOrderChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const tone = (frequency: number, startAt: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.35);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(ctx.currentTime + startAt);
      oscillator.stop(ctx.currentTime + startAt + 0.37);
    };

    tone(880, 0);
    tone(1175, 0.15);

    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay bloqueado ou API indisponível — sem som, sem quebrar a tela.
  }
}
