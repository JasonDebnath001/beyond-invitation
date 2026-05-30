declare module "isomorphic-dompurify" {
  const DOMPurify: {
    sanitize(input: string, options?: Record<string, unknown>): string;
  };

  export default DOMPurify;
}
