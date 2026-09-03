// Reaproveita a mesma arte do Open Graph para o card do X/Twitter.
// Os campos de config precisam ser literais no arquivo da rota (o Next os lê
// em tempo de compilação), então não dá para reexportá-los de opengraph-image.
export { default } from './opengraph-image';

export const alt = 'Zelo Confeitaria — doces artesanais em Pereiro, CE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';
