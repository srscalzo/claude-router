const FACES = [
  '(^‿^)',
  '(^‿-)',
  '(^‿^)',
  '(-‿^)',
  '(^‿^)',
  '(^‿^)',
  '(>‿<)',
  '(^‿^)',
];

const PIXELS = [' ▓░░ ', ' ▓▓░ ', ' ▓▓▓ ', ' ░▓▓ ', ' ░░▓ ', ' ░░░ ', ' ░▓░ ', ' ▓░▓ '];

export function startSpinner(message: string): () => void {
  let i = 0;

  const id = setInterval(() => {
    const face = FACES[i % FACES.length];
    const pixel = PIXELS[i % PIXELS.length];
    process.stderr.write(`\r  ${face}${pixel}${message}  `);
    i++;
  }, 120);

  return () => {
    clearInterval(id);
    process.stderr.write('\r' + ' '.repeat(50) + '\r');
  };
}
