import { JSDOM } from 'jsdom';

declare global {
    namespace globalThis {
        const jsdom: JSDOM;
    }
}