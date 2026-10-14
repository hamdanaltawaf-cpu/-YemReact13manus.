import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";
import { MAX_REACTION_DURATION_SECONDS } from "../shared/reactionLimits";
import { mediaPut, type MediaStoredFile } from "./mediaStorage";

const execFileAsync = promisify(execFile);
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BASE64_LENGTH = 14_000_000;
export const VIDEO_PROCESS_TIMEOUT_MS = 110_000;
export const allowedVideoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type VideoProcessingResult = {
  original: MediaStoredFile;
  processed: MediaStoredFile;
  thumbnail: MediaStoredFile;
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  processedSizeBytes: number;
  originalSizeBytes: number;
  sourceDurationSeconds: number;
  mimeType: "video/mp4";
};

export type VideoProcessorDependencies = {
  put?: typeof mediaPut;
  ffmpegPath?: string;
  ffprobePath?: string;
  onStage?: (event: { stage: "source_metadata" | "transcoding" | "thumbnail" | "output_metadata"; progressPercent: number }) => void | Promise<void>;
};

export async function storeOriginalVideo(input: { data: Buffer; fileName: string; contentType: string; storagePrefix: string }, put: typeof mediaPut = mediaPut) {
  const mimeType = validateVideoUpload(input.data, input.contentType);
  const safeName = cleanVideoFileName(input.fileName);
  const prefix = input.storagePrefix.replace(/[^A-Za-z0-9/_-]/g, "-");
  const stored = await put(`${prefix}/original/${safeName}`, input.data, mimeType);
  return { stored, mimeType, safeName };
}

export function decodeVideoBase64(dataBase64: string) {
  const raw = dataBase64.includes(",") ? dataBase64.slice(dataBase64.indexOf(",") + 1) : dataBase64;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) throw new Error("صيغة ملف الفيديو غير صالحة.");
  const data = Buffer.from(raw, "base64");
  if (!data.length || data.length > MAX_VIDEO_BYTES) throw new Error("يجب ألا يتجاوز حجم الفيديو 10 ميجابايت.");
  return data;
}

export function detectVideoMimeType(data: Buffer): "video/mp4" | "video/webm" | "video/quicktime" | null {
  if (data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = data.subarray(8, 12).toString("ascii").toLowerCase();
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (data.length >= 4 && data.subarray(0, 4).toString("hex") === "1a45dfa3") return "video/webm";
  return null;
}

export function validateVideoUpload(data: Buffer, contentType: string) {
  if (data.length > MAX_VIDEO_BYTES) throw new Error("يجب ألا يتجاوز حجم الفيديو 10 ميجابايت.");
  if (!allowedVideoMimeTypes.has(contentType)) throw new Error("الصيغ المقبولة هي MP4 أو WebM أو MOV فقط.");
  const detected = detectVideoMimeType(data);
  if (!detected) throw new Error("تعذر التحقق من بنية الفيديو. اختر ملف MP4 أو WebM أو MOV صالحاً.");
  if (detected !== contentType && !(detected === "video/mp4" && contentType === "video/quicktime")) {
    throw new Error("نوع الملف لا يطابق بنية الفيديو الفعلية.");
  }
  return detected;
}

export function cleanVideoFileName(fileName: string) {
  return basename(fileName).replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "reaction-video";
}

function originalExtension(mimeType: string, originalName: string) {
  const extension = extname(originalName).toLowerCase();
  if ([".mp4", ".webm", ".mov"].includes(extension)) return extension;
  return mimeType === "video/webm" ? ".webm" : mimeType === "video/quicktime" ? ".mov" : ".mp4";
}

export function buildVideoFilter() {
  return "scale='if(gte(iw,ih),min(iw,1280),-2)':'if(gte(iw,ih),-2,min(ih,1280))'";
}

async function probeVideo(filePath: string, ffprobePath: string) {
  const { stdout } = await execFileAsync(ffprobePath, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", filePath], {
    timeout: VIDEO_PROCESS_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  const data = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }> };
  const video = data.streams?.find(stream => stream.codec_type === "video");
  const audio = data.streams?.find(stream => stream.codec_type === "audio");
  const durationSeconds = Math.max(1, Math.round(Number(data.format?.duration ?? 0)));
  if (!video?.width || !video.height || !durationSeconds || !video.codec_name) throw new Error("تعذر استخراج بيانات الفيديو بعد المعالجة.");
  return { durationSeconds, width: video.width, height: video.height, videoCodec: video.codec_name, audioCodec: audio?.codec_name ?? null };
}

export async function processVideoUpload(input: { data: Buffer; fileName: string; contentType: string; storagePrefix: string; original?: MediaStoredFile }, dependencies: VideoProcessorDependencies = {}): Promise<VideoProcessingResult> {
  const mimeType = validateVideoUpload(input.data, input.contentType);
  const put = dependencies.put ?? mediaPut;
  const ffmpegPath = dependencies.ffmpegPath ?? "ffmpeg";
  const ffprobePath = dependencies.ffprobePath ?? "ffprobe";
  const safeName = cleanVideoFileName(input.fileName);
  const prefix = input.storagePrefix.replace(/[^A-Za-z0-9/_-]/g, "-");
  const original = input.original ?? (await put(`${prefix}/original/${safeName}`, input.data, mimeType));
  const workingDirectory = await mkdtemp(join(tmpdir(), "yemreact-video-"));
  const inputPath = join(workingDirectory, `input${originalExtension(mimeType, safeName)}`);
  const outputPath = join(workingDirectory, "yemreact-processed.mp4");
  const thumbnailPath = join(workingDirectory, "yemreact-thumbnail.jpg");

  try {
    await writeFile(inputPath, input.data);
    await dependencies.onStage?.({ stage: "source_metadata", progressPercent: 18 });
    const sourceMetadata = await probeVideo(inputPath, ffprobePath);
    const filter = buildVideoFilter();
    await dependencies.onStage?.({ stage: "transcoding", progressPercent: 32 });
    await execFileAsync(ffmpegPath, [
      "-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a?", "-vf", filter,
      "-c:v", "libx264", "-crf", "20", "-preset", "faster", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outputPath,
    ], { timeout: VIDEO_PROCESS_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 });
    await dependencies.onStage?.({ stage: "thumbnail", progressPercent: 78 });
    await execFileAsync(ffmpegPath, ["-y", "-ss", "0.25", "-i", outputPath, "-frames:v", "1", "-q:v", "3", thumbnailPath], {
      timeout: VIDEO_PROCESS_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    await dependencies.onStage?.({ stage: "output_metadata", progressPercent: 90 });
    const [processedData, thumbnailData, processedStat] = await Promise.all([readFile(outputPath), readFile(thumbnailPath), stat(outputPath)]);
    if (!processedData.length || processedStat.size > 50 * 1024 * 1024 || !thumbnailData.length) {
      throw new Error("تعذر إنتاج ملفات فيديو صالحة بالحجم المتوقع.");
    }
    const metadata = await probeVideo(outputPath, ffprobePath);
    if (metadata.videoCodec !== "h264") throw new Error("لم يكتمل تحويل الفيديو إلى H.264.");
    if (metadata.durationSeconds > MAX_REACTION_DURATION_SECONDS) {
      throw new Error(`يجب ألا تتجاوز مدة الفيديو بعد المعالجة ${MAX_REACTION_DURATION_SECONDS} ثانية.`);
    }
    const processed = await put(`${prefix}/processed/reaction.mp4`, processedData, "video/mp4");
    const thumbnail = await put(`${prefix}/thumbnail/reaction.jpg`, thumbnailData, "image/jpeg");
    return { original, processed, thumbnail, originalSizeBytes: input.data.length, processedSizeBytes: processedStat.size, sourceDurationSeconds: sourceMetadata.durationSeconds, mimeType: "video/mp4", ...metadata };
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشلت معالجة الفيديو.";
    if (message.includes("timed out")) throw new Error("تجاوزت معالجة الفيديو المهلة المسموح بها. جرّب مقطعاً أقصر.");
    throw error;
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
