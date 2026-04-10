declare module 'text-to-svg' {
  export interface GenerationOptions {
    x?: number
    y?: number
    fontSize?: number
    anchor?: 'top' | 'middle' | 'bottom' | 'top-left' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right'
    attributes?: Record<string, string>
  }

  export interface TextToSVG {
    getSVG(text: string, options?: GenerationOptions): string
    getD(text: string, options?: GenerationOptions): string
    getPath(text: string, options?: GenerationOptions): string
    getWidth(text: string, options?: GenerationOptions): number
    getHeight(text: string, options?: GenerationOptions): number
    getMetrics(text: string, options?: GenerationOptions): {
      x: number
      y: number
      width: number
      height: number
      baseline: number
    }
  }

  function TextToSVG(): TextToSVG
  namespace TextToSVG {
    function loadSync(fontPath?: string): TextToSVG
    function load(fontPath: string, callback: (err: Error | null, textToSVG: TextToSVG) => void): void
  }

  export default TextToSVG
}
