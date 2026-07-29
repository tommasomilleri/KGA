/// <reference lib="webworker" />
import { pipeline, type FeatureExtractionPipeline }
  from '@huggingface/transformers';

let pipe: FeatureExtractionPipeline | null = null;

self.onmessage = async (e: MessageEvent<{ id: number; text: string }>) => {
  const { id, text } = e.data;
  try {
    if (!pipe) {
      const createPipe = pipeline as (task:string, model:string) => Promise<FeatureExtractionPipeline>;
      const p = await createPipe('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2');
      pipe = p as FeatureExtractionPipeline;
    }
    const out = await pipe(text, { pooling: 'mean', normalize: true });
    self.postMessage({ id, vector: Array.from(out.data as Float32Array) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};