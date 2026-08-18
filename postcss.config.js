import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const isProd = process.env.NODE_ENV === 'production';

export default {
  plugins: [autoprefixer(), ...(isProd ? [cssnano({ preset: ['default', { normalizeWhitespace: true }] })] : [])],
};
