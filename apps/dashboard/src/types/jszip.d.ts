// Minimal ambient declaration for jszip until the package is installed.
// Once `pnpm install` is run, the bundled types in jszip/index.d.ts will take over.
declare module 'jszip' {
  interface JSZipObject {
    name: string;
  }
  interface OutputByType {
    blob: Blob;
    arraybuffer: ArrayBuffer;
    uint8array: Uint8Array;
    nodebuffer: Buffer;
    base64: string;
    text: string;
    binarystring: string;
  }
  interface GenerateOptions {
    type: keyof OutputByType;
    compression?: string;
    compressionOptions?: { level: number };
  }
  class JSZip {
    file(name: string, data: string | Blob | ArrayBuffer | Uint8Array, options?: { base64?: boolean }): this;
    generateAsync<T extends keyof OutputByType>(options: GenerateOptions & { type: T }): Promise<OutputByType[T]>;
    generateAsync(options: GenerateOptions): Promise<Blob>;
  }
  const jszip: {
    new(): JSZip;
    default: { new(): JSZip };
  };
  export = JSZip;
}
