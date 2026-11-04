export type SynapseFile = { path: string; content: string; encoding: 'utf8' | 'base64' };
export type SynapseProject = { id: string; name: string; mainFile: string; files: SynapseFile[]; createdAt: string; updatedAt: string; lastPdf?: string; lastLog?: string };
export type CompileResult = { ok: boolean; pdf?: string; log: string; error?: string };
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Provider = 'openai' | 'gemini' | 'groq' | 'openrouter' | 'sambanova' | 'cerebras' | 'together';
