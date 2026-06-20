declare module '*.css';
declare module '*.png';
declare module '*.ico';

declare global {
	namespace JSX {
		interface IntrinsicElements {
			[elemName: string]: any;
		}
	}
}

export {};
