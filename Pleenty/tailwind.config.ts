import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { leaf: '#26734d', ink: '#17231c', cream: '#f7f7f0' } } }, plugins: [] };
export default config;
